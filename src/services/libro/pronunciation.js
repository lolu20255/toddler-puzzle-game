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
 * Caching:
 *   In-memory `HTMLAudioElement`s keyed by `<provider>:<lang>:<word>` — same
 *   shape as the backend's `storage/words/<provider>/<lang>/<word>.mp3`, so
 *   switching providers really does fetch the new voice instead of replaying
 *   the cached one from the old provider.
 *
 * All failures are silent — pronunciation is a nice-to-have, never blocks the
 * celebration modal.
 */
import { HTTP } from './http'
import { libroAuth } from './auth'

const DEFAULT_PROVIDER =
  import.meta.env.VITE_LIBRO_PRONUNCIATION_PROVIDER || 'elevenlabs'

const audioByKey = new Map() // key → HTMLAudioElement
const inflight = new Map() // key → Promise<HTMLAudioElement|null>

function cacheKey(word, lang, provider) {
  return `${provider}:${lang}:${String(word).toLowerCase()}`
}

async function fetchAudio(word, lang, provider) {
  try {
    const authed = await libroAuth.ensureAuthenticated()
    if (!authed) return null
    const response = await HTTP.post(
      '/v1/pronunciations',
      { word, language: lang, provider },
      { responseType: 'blob' }
    )
    const blob = response.data
    if (!blob || blob.size === 0) return null
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.preload = 'auto'
    return audio
  } catch (e) {
    // 401 with "Invalid token" → drop the cached token and let the next call re-auth.
    if (e?.response?.status === 401) {
      libroAuth.clear()
    }
    console.warn(
      `[Pronunciation] fetch failed for "${word}" (${lang}/${provider}):`,
      e?.message || e
    )
    return null
  }
}

/** Fetch and cache the audio for `word` without playing it. */
export async function preload(word, lang = 'en', provider = DEFAULT_PROVIDER) {
  if (!word) return null
  const key = cacheKey(word, lang, provider)
  if (audioByKey.has(key)) return audioByKey.get(key)
  if (!inflight.has(key)) {
    inflight.set(
      key,
      fetchAudio(word, lang, provider).finally(() => inflight.delete(key))
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
