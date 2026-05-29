/**
 * libro-ai device-based authentication + 401-refresh interceptor.
 *
 * Two layers:
 *   1. `ensureAuthenticated()` — first-launch auth: cached token → login →
 *      register. Memoised across concurrent callers.
 *   2. `setupInterceptor()` — axios response interceptor that watches for
 *      `401 "Invalid token"` on protected endpoints, transparently
 *      refreshes the token, re-attaches the new Bearer header, and
 *      retries the original request. Mirrors the pattern from libro-ai-app
 *      so a burst of celebration-audio requests on a stale token doesn't
 *      cascade into visible failures.
 *
 * Two layers, two memoised promises (`inflight` for the first-launch dance,
 * `refreshInflight` for refresh) so a refresh triggered mid-flight by one
 * request doesn't race with another.
 *
 * Every failure logs and resolves to `false`/`null` — pronunciation audio
 * is a nice-to-have, never block the game on it.
 */
import { Device } from '@capacitor/device'
import { Capacitor } from '@capacitor/core'
import { HTTP } from './http'
import { Storage } from '../storage'

const TOKEN_KEY = 'libroAuthToken'
const DEVICE_FALLBACK_KEY = 'libroDeviceId'

let inflight = null
let refreshInflight = null
let interceptorInstalled = false

async function getDeviceId() {
  try {
    const info = await Device.getId()
    if (info?.identifier) return info.identifier.replace(/\s+/g, '').trim()
  } catch {
    /* fall through to web fallback */
  }
  let id = await Storage.get(DEVICE_FALLBACK_KEY)
  if (!id) {
    id =
      'web_' +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    await Storage.set(DEVICE_FALLBACK_KEY, id)
  }
  return id
}

function platformSuffix() {
  const p = Capacitor.getPlatform()
  if (p === 'ios') return 'ios.device'
  if (p === 'android') return 'android.device'
  return 'web.device'
}

async function makeCredentials() {
  const deviceId = await getDeviceId()
  return {
    username: deviceId,
    email: `${deviceId}@${platformSuffix()}`,
    password: `${deviceId}_libro_ai`
  }
}

function applyToken(token) {
  HTTP.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

function clearTokenHeader() {
  delete HTTP.defaults.headers.common['Authorization']
}

async function tryLogin(creds) {
  const r = await HTTP.post('/v1/sessions', {
    email: creds.email,
    password: creds.password
  })
  return r.data?.token
}

async function tryRegister(creds) {
  const r = await HTTP.post('/v1/users', {
    email: creds.email,
    password: creds.password,
    password_confirmation: creds.password,
    name: creds.username
  })
  return r.data?.token
}

/** Login → fallback register. Returns the token or `null`. */
async function authenticate() {
  const creds = await makeCredentials()
  try {
    return await tryLogin(creds)
  } catch {
    try {
      return await tryRegister(creds)
    } catch {
      return null
    }
  }
}

export const libroAuth = {
  /** Current bearer token (from in-memory header), or `null`. */
  getToken() {
    const h = HTTP.defaults.headers.common['Authorization']
    return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null
  },

  /**
   * Run the first-launch auth dance once. Resolves to `true` on success,
   * `false` on any failure. Subsequent calls reuse the same in-flight
   * promise, then fall through to the cached header check.
   *
   * Also installs the response interceptor on the first call so the
   * 401-refresh flow is ready before any subsequent protected request.
   */
  async ensureAuthenticated() {
    this.setupInterceptor()

    if (this.getToken()) return true
    if (inflight) return inflight

    inflight = (async () => {
      try {
        // Cached token from a previous launch?
        const cached = await Storage.get(TOKEN_KEY)
        if (cached) {
          applyToken(cached)
          return true
        }
        const token = await authenticate()
        if (!token) throw new Error('No token returned from libro auth')
        await Storage.set(TOKEN_KEY, token)
        applyToken(token)
        return true
      } catch (e) {
        console.warn('[LibroAuth] init failed:', e?.message || e)
        return false
      } finally {
        inflight = null
      }
    })()
    return inflight
  },

  /**
   * Force a fresh login (clear cached token first). Used by the response
   * interceptor when a request fails with `401 "Invalid token"` — the cached
   * token has been rotated/expired server-side. Memoised so a burst of 401s
   * during a celebration only triggers one auth dance.
   */
  async refreshToken() {
    if (refreshInflight) return refreshInflight
    refreshInflight = (async () => {
      try {
        clearTokenHeader()
        await Storage.remove(TOKEN_KEY).catch(() => {})
        const token = await authenticate()
        if (!token) return false
        await Storage.set(TOKEN_KEY, token)
        applyToken(token)
        console.log('[LibroAuth] token refreshed')
        return true
      } catch (e) {
        console.warn('[LibroAuth] refresh failed:', e?.message || e)
        return false
      } finally {
        refreshInflight = null
      }
    })()
    return refreshInflight
  },

  /** Wipe the token from memory + disk. Forces re-auth on next call. */
  clear() {
    clearTokenHeader()
    Storage.remove(TOKEN_KEY).catch(() => {})
  },

  /**
   * Install the axios response interceptor that watches for `401 +
   * "Invalid token"` and transparently refreshes the token + retries the
   * original request. Idempotent — safe to call from multiple places.
   *
   * Skips the auth endpoints themselves (`/v1/sessions`, `/v1/users`) so
   * the refresh flow can't recurse on its own login/register attempts.
   *
   * Handles blob responses too — `/v1/pronunciations` uses `responseType:
   * 'blob'`, so on 401 the error body is a Blob that must be read as text
   * and parsed as JSON to extract the `error` field.
   *
   * Uses `originalRequest._retry` as a one-shot guard so a stuck-401 path
   * doesn't loop forever.
   */
  setupInterceptor() {
    if (interceptorInstalled) return
    interceptorInstalled = true

    HTTP.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // Already retried — let the failure bubble up.
        if (!originalRequest || originalRequest._retry) {
          return Promise.reject(error)
        }

        // Never refresh on the auth endpoints themselves. They legitimately
        // 401 during the refresh flow and own their own failure handling
        // (login falls through to register inside `authenticate()`).
        const url = originalRequest.url || ''
        if (url.includes('/v1/sessions') || url.includes('/v1/users')) {
          return Promise.reject(error)
        }

        if (error.response?.status !== 401) {
          return Promise.reject(error)
        }

        // Pull the error message out — works for both JSON responses AND
        // blob responses (which is what /v1/pronunciations returns since
        // it's a `responseType: 'blob'` call).
        let errorMessage = null
        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text()
            const json = JSON.parse(text)
            errorMessage = json.error
          } catch {
            /* not JSON — fall through */
          }
        } else {
          errorMessage = error.response.data?.error
        }

        if (errorMessage !== 'Invalid token') {
          return Promise.reject(error)
        }

        console.log('[LibroAuth] Invalid token detected — refreshing + retrying')
        originalRequest._retry = true

        const ok = await this.refreshToken()
        if (!ok) return Promise.reject(error)

        const newToken = this.getToken()
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`

        return HTTP(originalRequest)
      }
    )
    console.log('[LibroAuth] HTTP interceptor installed')
  }
}
