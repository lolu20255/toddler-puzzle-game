/**
 * libro-ai device-based authentication.
 *
 * Mirrors the libro-ai-app pattern: the device's native identifier becomes
 * the username, with a derived email + password. Tries to log in first; if
 * the user doesn't exist yet, registers them. Token is cached in
 * Capacitor Preferences so subsequent launches don't have to re-auth.
 *
 * `ensureAuthenticated()` is memoised — concurrent callers (e.g. multiple
 * pronunciation requests firing back-to-back) all await the same promise.
 *
 * Every failure is logged and swallowed — pronunciation audio is a
 * nice-to-have, never block the game on it.
 */
import { Device } from '@capacitor/device'
import { Capacitor } from '@capacitor/core'
import { HTTP } from './http'
import { Storage } from '../storage'

const TOKEN_KEY = 'libroAuthToken'
const DEVICE_FALLBACK_KEY = 'libroDeviceId'

let inflight = null

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

export const libroAuth = {
  /** Get the current token (from in-memory header) — null if unauthenticated. */
  getToken() {
    const h = HTTP.defaults.headers.common['Authorization']
    return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null
  },

  /**
   * Run the auth dance once. Resolves to `true` on success, `false` on any
   * failure. Subsequent calls reuse the same in-flight promise, then fall
   * through to the cached header check.
   */
  async ensureAuthenticated() {
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

        const creds = await makeCredentials()
        let token = null
        try {
          token = await tryLogin(creds)
        } catch {
          token = await tryRegister(creds)
        }
        if (!token) throw new Error('No token returned from libro auth')

        await Storage.set(TOKEN_KEY, token)
        applyToken(token)
        return true
      } catch (e) {
        console.warn('[LibroAuth] init failed:', e?.message || e)
        return false
      } finally {
        // Allow retry on later calls if this attempt failed (e.g. offline).
        inflight = null
      }
    })()

    return inflight
  },

  /** Force re-auth on the next call. Used if the token is rejected. */
  clear() {
    delete HTTP.defaults.headers.common['Authorization']
    Storage.remove(TOKEN_KEY).catch(() => {})
  }
}
