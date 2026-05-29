/**
 * Spoken-word pronunciation via libro-ai.
 *
 * Public API:
 *   - `speak(word, lang='en', provider=DEFAULT_PROVIDER)`
 *     fetch (with cache) + play audio for `word`.
 *   - `preload(word, lang, provider)`        fetch (cache) without playing.
 *   - `preloadMany(words, lang, provider)`   parallel preload.
 *
 * Provider:
 *   The backend supports `openai` (its own default) and `elevenlabs` (voice
 *   `NoOVOzCQFLOvtsMoNcdT`). We default to ElevenLabs and let it be overridden
 *   per-call or globally via `VITE_LIBRO_PRONUNCIATION_PROVIDER`. Bad values
 *   get a 422 from the backend, which surfaces here as a silent miss.
 *
 * Caching — two tiers:
 *   1. Memory cache (`HTMLAudioElement`) keyed by `<provider>:<lang>:<word>`
 *      → fast playback, transient per-session.
 *   2. IndexedDB blob store (`audioStore.js`) → persists across app launches.
 *      First play of a phrase hits the API; every subsequent launch reads
 *      the MP3 from disk and never calls the network again. Cost per cached
 *      phrase: ~5-30 KB of WebView storage.
 *
 *   Key shape matches the backend's `storage/words/<provider>/<lang>/<word>.mp3`
 *   so switching providers really fetches the new voice instead of replaying
 *   the cached one from the old provider.
 *
 * All failures are silent — pronunciation is a nice-to-have, never blocks the
 * celebration modal.
 */
import { HTTP } from './http'
import { libroAuth } from './auth'
import { getBlob, putBlob } from './audioStore'

const DEFAULT_PROVIDER = import.meta.env.VITE_LIBRO_PRONUNCIATION_PROVIDER || 'elevenlabs'

const audioByKey = new Map() // key → HTMLAudioElement
const inflight = new Map() // key → Promise<HTMLAudioElement|null>

function cacheKey(word, lang, provider) {
  return `${provider}:${lang}:${String(word).toLowerCase()}`
}

/** Wrap a blob in a fresh HTMLAudioElement. */
function audioFromBlob(blob) {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.preload = 'auto'
  return audio
}

/** Hit the API for fresh TTS. Returns the raw MP3 blob, or null on failure. */
async function fetchBlob(word, lang, provider) {
  // Hard offline gate. Without this, an offline POST in WKWebView can hang
  // for the full axios timeout (10s) before failing, which froze the
  // celebration whenever a phrase wasn't already cached on disk.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.log(`[Pronunciation] offline; skipping API fetch for "${word}"`)
    return null
  }
  try {
    const authed = await libroAuth.ensureAuthenticated()
    if (!authed) return null

    // If this request fails with 401 "Invalid token", the response interceptor
    // installed by `libroAuth.setupInterceptor()` transparently refreshes the
    // token and retries — no need to handle 401 here.
    const response = await HTTP.post(
      '/v1/pronunciations',
      { word, language: lang, provider },
      { responseType: 'blob' }
    )
    const blob = response.data
    if (!blob || blob.size === 0) return null
    return blob
  } catch (e) {
    console.warn(
      `[Pronunciation] fetch failed for "${word}" (${lang}/${provider}):`,
      e?.message || e
    )
    return null
  }
}

/**
 * Fetch and cache the audio for `word` without playing it. Resolves with a
 * ready-to-play HTMLAudioElement, or null if the audio could not be obtained.
 *
 * Lookup order: memory cache → IndexedDB → API. The disk hit avoids a network
 * round-trip on every subsequent app launch.
 */
export async function preload(word, lang = 'en', provider = DEFAULT_PROVIDER) {
  if (!word) return null

  const key = cacheKey(word, lang, provider)

  // L1 — memory.
  if (audioByKey.has(key)) return audioByKey.get(key)

  if (!inflight.has(key)) {
    inflight.set(
      key,
      (async () => {
        // L2 — IndexedDB. A hit here means the toddler has heard this phrase
        // in a previous launch; replay it without a network call.
        const cachedBlob = await getBlob(key)
        if (cachedBlob) {
          console.log(
            `[Pronunciation] disk hit for "${word}" (${lang}/${provider})`
          )
          return audioFromBlob(cachedBlob)
        }

        // L3 — API. On success, persist to disk for next launch.
        const blob = await fetchBlob(word, lang, provider)
        if (!blob) return null
        await putBlob(key, blob)
        return audioFromBlob(blob)
      })().finally(() => inflight.delete(key))
    )
  }

  const audio = await inflight.get(key)
  if (audio) audioByKey.set(key, audio)
  return audio
}

/** Preload many words in parallel. */
export function preloadMany(words, lang = 'en', provider = DEFAULT_PROVIDER) {
  return Promise.allSettled(words.map((w) => preload(w, lang, provider)))
}

/**
 * Fetch (with cache) and play the audio for `word`. Safe to call from the
 * celebration modal's open — silent failure on any error.
 */
export async function speak(word, lang = 'en', provider = DEFAULT_PROVIDER) {
  const audio = await preload(word, lang, provider)
  if (!audio) return
  try {
    audio.currentTime = 0
    await audio.play()
  } catch (e) {
    // Autoplay restrictions, missing user gesture, etc. — best-effort.
    console.warn('[Pronunciation] play failed for', word, e?.message || e)
  }
}

/** Expose the currently-configured default for logging / sanity checks. */
export function getDefaultProvider() {
  return DEFAULT_PROVIDER
}

