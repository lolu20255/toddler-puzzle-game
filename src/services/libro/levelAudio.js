/**
 * Level-pack audio loader — prefers the bundled MP3 over any API call.
 *
 * Production flow:
 *   1. Dev pre-generated the file with `npm run generate:audio` and committed
 *      it to `public/audio/levels/<lang>/<pack>/<letter>.mp3`.
 *   2. App ships those MP3s in the static bundle.
 *   3. At runtime, this helper `fetch()`s the local URL — zero network call,
 *      zero libro API spend, zero auth dependency.
 *
 * Fallback flow (file missing — e.g. a new word added without re-running the
 * generator):
 *   1. Build the same spelling+pronunciation phrase the script would have
 *      generated.
 *   2. Defer to the regular `preload()` which hits memory → IndexedDB → API.
 *      A successful API fetch is persisted to IDB, so subsequent launches
 *      replay it instantly without a network call.
 *
 * Per-toddler "Good job <Name>!" praise is NOT routed through here — that
 * always goes through `preload()` because the name is dynamic per device.
 */
import { nameForAssetKey, isWordOnlyPack } from '../../game/itemNames'
import { preload } from './pronunciation'

// Per-session memory cache so repeated celebrations of the same piece don't
// re-fetch the bundled MP3. Bundle fetch is local + cheap, but caching the
// resulting Audio element also keeps its blob URL stable, which avoids any
// reload latency the WKWebView would add on the second play.
const audioByKey = new Map()

/**
 * Pause every cached level-pack audio that is currently playing and rewind
 * it to the start. Mirrors `stopAllPronunciations` in pronunciation.js and is
 * called from the same scene-exit hook so both the spelling audio (this file)
 * and the praise audio (pronunciation.js) silence together.
 */
export function stopAllLevelAudio() {
  audioByKey.forEach((audio) => {
    try {
      if (!audio.paused) audio.pause()
      audio.currentTime = 0
    } catch {
      /* the element may already be in a bad state — ignore */
    }
  })
}

/** Parse an asset key like `asset_animal_cartoon_a` → `{ pack, letter }`. */
function parseAssetKey(assetKey) {
  const m = /^asset_(.+)_([a-j])$/.exec(assetKey || '')
  if (!m) return null
  return { pack: m[1], letter: m[2] }
}

function bundledUrl(pack, letter, lang) {
  return `/audio/levels/${lang}/${pack}/${letter}.mp3`
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Load a bundled MP3 by URL via an HTMLAudioElement directly.
 *
 * We do NOT use `fetch()` here. In Capacitor iOS, WKWebView's URL scheme
 * handler is flaky for `fetch()` of bundled assets — it returns HTTP 0
 * (network error) instead of 200, even when the file is right there on
 * disk and would load fine via an <img> or <audio> tag. The HTML audio
 * loader goes through the WebView's standard resource pipeline and works
 * reliably for everything in `public/`.
 *
 * Resolves with a ready-to-play Audio element on success, null on failure.
 */
async function loadBundledUrl(url) {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'auto'

    let settled = false
    const finish = (success, reason) => {
      if (settled) return
      settled = true
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onError)
      if (success) {
        console.log(`[levelAudio] bundle hit ${url}`)
        resolve(audio)
      } else {
        console.log(`[levelAudio] bundle miss ${url}: ${reason}`)
        resolve(null)
      }
    }
    const onReady = () => finish(true)
    const onError = () => finish(false, 'load error')

    // `loadedmetadata` fires as soon as duration/format is known — that's
    // enough to start playback. `canplay` is a secondary signal for browsers
    // that skip metadata events on small files. Either one resolves.
    audio.addEventListener('loadedmetadata', onReady, { once: true })
    audio.addEventListener('canplay', onReady, { once: true })
    audio.addEventListener('error', onError, { once: true })

    // Safety net — if neither `loadedmetadata` nor `error` fires (e.g. the
    // request goes out and bytes never come back), bail out so the
    // celebration falls through to the visual-only path instead of waiting
    // forever for an Audio element that will never load.
    setTimeout(() => finish(false, 'timeout (3s)'), 3000)

    audio.src = url
    audio.load()
  })
}

/** Load the bundled word MP3 for an asset (pack/letter). */
async function tryBundled(pack, letter, lang) {
  return loadBundledUrl(bundledUrl(pack, letter, lang))
}

/**
 * Get the spelling+pronunciation audio for an asset, preferring the
 * bundled file. Returns a ready-to-play HTMLAudioElement, or null if
 * neither the bundle nor the API can supply one.
 */
export async function preloadLevelAudio(assetKey, lang = 'en') {
  const parsed = parseAssetKey(assetKey)
  if (!parsed) return null

  const cacheKey = `${lang}:${parsed.pack}:${parsed.letter}`
  if (audioByKey.has(cacheKey)) return audioByKey.get(cacheKey)

  const bundled = await tryBundled(parsed.pack, parsed.letter, lang)
  if (bundled) {
    audioByKey.set(cacheKey, bundled)
    return bundled
  }

  // No bundle file for this asset. If we're offline, give up immediately —
  // calling the API in airplane mode used to hang the entire celebration
  // for up to the axios timeout (10s) waiting for a network response that
  // would never arrive.
  if (isOffline()) {
    console.log(
      `[levelAudio] offline + no bundle for ${cacheKey}; skipping API`
    )
    return null
  }

  // Online + no bundle → reconstruct the phrase and use the regular cached
  // fetcher. Matches `scripts/generate-level-audios.mjs → buildMainPhrase()`
  // exactly so the IDB key + the file we'd have on disk would line up.
  const word = nameForAssetKey(assetKey, lang)
  if (!word) return null
  return preload(buildPhrase(word, lang, parsed.pack), lang)
}

/**
 * Bundled celebration praise ("Good job!" / "¡Muy bien!"), pre-generated into
 * `public/audio/praise/<lang>.mp3` by `npm run generate:audio`. Cached in
 * `audioByKey` like the word audio, so `stopAllLevelAudio()` (and therefore
 * `stopAllSpeech()`) silences it on scene exit / back button. The running app
 * never calls the API for this — it always plays from the local file.
 */
export async function preloadPraise(lang = 'en') {
  const l = lang === 'es' ? 'es' : 'en'
  const cacheKey = `praise:${l}`
  if (audioByKey.has(cacheKey)) return audioByKey.get(cacheKey)
  const audio = await loadBundledUrl(`/audio/praise/${l}.mp3`)
  if (audio) audioByKey.set(cacheKey, audio)
  return audio
}

/**
 * Build the spelling+pronunciation phrase the TTS reads.
 *
 *   - Multi-character word: "A, P, P, L, E. APPLE!"  (English)
 *                           "¡¡¡A, P, P, L, E. APPLE!!!"  (Spanish — the
 *                           inverted-bang framing makes ElevenLabs pick the
 *                           right intonation, discovered by trial-and-error)
 *   - Single-character word (Letters pack, e.g. "A"): just "A!" — spelling
 *                           a single letter as itself sounds redundant.
 *   - Word-only pack (Count, e.g. "ONE"): just "One!" — a counting game
 *                           should never spell the number out.
 *
 * Must stay in lockstep with `scripts/generate-level-audios.mjs` so the
 * bundled MP3 filename and the runtime fallback phrase agree.
 */
export function buildPhrase(word, lang, pack) {
  if (word.length === 1 || isWordOnlyPack(pack)) {
    return lang === 'es' ? `¡${word}!` : `${word}!`
  }
  const spelled = word.split('').join(', ')
  return lang === 'es' ? `¡¡¡${spelled}. ${word}!!!` : `${spelled}. ${word}!`
}
