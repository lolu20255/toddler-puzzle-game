#!/usr/bin/env node
/**
 * Pre-generate every spelling+pronunciation MP3 the game ever needs and
 * write them to `public/audio/levels/<lang>/<pack>/<letter>.mp3`.
 *
 * Run this in development whenever you add a new pack, a new word, or
 * change a phrase template. The generated files are checked into the
 * repo and shipped with the app bundle, so production never calls the
 * libro API for these phrases — we only hit the network for per-toddler
 * "Good job <Name>!" praise.
 *
 * Usage:
 *   npm run generate:audio
 *
 * Env overrides:
 *   LIBRO_API_BASE_URL   default https://libro-ai.blackboxcode.io
 *   LIBRO_PROVIDER       default elevenlabs
 *   LIBRO_LANGS          default en,es  (comma-separated)
 *   LIBRO_DEVICE_ID      default dev-audio-batch  (the script's "device")
 *   FORCE                set to "1" to overwrite existing files
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ITEM_NAMES, isWordOnlyPack } from '../src/game/itemNames.js'

const __filename = fileURLToPath(import.meta.url)
const projectRoot = join(dirname(__filename), '..')

const BASE_URL = process.env.LIBRO_API_BASE_URL || 'https://libro-ai.blackboxcode.io'
const PROVIDER = process.env.LIBRO_PROVIDER || 'elevenlabs'
const LANGS = (process.env.LIBRO_LANGS || 'en,es').split(',').map((s) => s.trim())
const DEVICE_ID = process.env.LIBRO_DEVICE_ID || 'dev-audio-batch'
const FORCE = process.env.FORCE === '1'

const OUT_ROOT = join(projectRoot, 'public', 'audio', 'levels')

// Non-pack phrases that also ship as bundled MP3s, so the RUNNING app never
// calls the libro API. Output: public/audio/<slug>/<lang>.mp3. One phrase per
// language (no spelling). The celebration praise lives here.
const EXTRAS = {
  praise: { en: 'Good job!', es: '¡Muy bien!' }
}

const creds = {
  email: `${DEVICE_ID}@dev.script`,
  password: `${DEVICE_ID}_libro_ai`,
  name: DEVICE_ID
}

let token = null

async function api(path, body, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${path} → ${res.status} ${text.slice(0, 200)}`)
  }
  return opts.raw ? res : res.json()
}

async function authenticate() {
  // Try login → fall back to register. Same as the in-app flow.
  try {
    const r = await api('/v1/sessions', { email: creds.email, password: creds.password })
    return r.token
  } catch {
    const r = await api('/v1/users', {
      email: creds.email,
      password: creds.password,
      password_confirmation: creds.password,
      name: creds.name
    })
    return r.token
  }
}

/**
 * Build the same phrase the runtime uses (kept in lockstep with
 * `src/services/libro/levelAudio.js → buildPhrase()`).
 *
 *   - Multi-character word → spelling + word (e.g. "A, P, P, L, E. APPLE!")
 *   - Single-character word (Letters pack) → just the letter (e.g. "A!")
 *     because spelling "A" as "A. A!" sounds redundant.
 *   - Word-only pack (Count) → just the word (e.g. "One!"), never spelled.
 */
function buildMainPhrase(word, lang, pack) {
  if (word.length === 1 || isWordOnlyPack(pack)) {
    return lang === 'es' ? `¡${word}!` : `${word}!`
  }
  const spelled = word.split('').join(', ')
  return lang === 'es' ? `¡¡¡${spelled}. ${word}!!!` : `${spelled}. ${word}!`
}

/**
 * POST /v1/pronunciations with a single 401 retry that re-authenticates
 * first. Mirrors the in-app axios interceptor — the libro backend rotates
 * tokens server-side after a while, and a long batch run will outlive any
 * one token. Without this, a successful first 20 requests reliably
 * cascade into 401 failures for the rest.
 */
async function fetchPronunciation(phrase, lang, attempt = 0) {
  const res = await fetch(`${BASE_URL}/v1/pronunciations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ word: phrase, language: lang, provider: PROVIDER })
  })
  if (res.status === 401 && attempt === 0) {
    console.log('  ↻ token rotated server-side; re-authenticating…')
    token = await authenticate()
    if (!token) throw new Error('re-auth returned no token')
    return fetchPronunciation(phrase, lang, attempt + 1)
  }
  if (!res.ok) {
    throw new Error(`pronunciation HTTP ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/** Small delay between requests so we don't burst the API into rotating. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`[generate-audio] BASE_URL: ${BASE_URL}`)
  console.log(`[generate-audio] provider: ${PROVIDER}`)
  console.log(`[generate-audio] langs:    ${LANGS.join(', ')}`)
  console.log(`[generate-audio] output:   ${OUT_ROOT}`)
  console.log(`[generate-audio] force:    ${FORCE}`)

  console.log('[generate-audio] authenticating…')
  token = await authenticate()
  if (!token) throw new Error('Authentication returned no token')
  console.log('[generate-audio] auth OK')

  let done = 0
  let skipped = 0
  let failed = 0

  for (const lang of LANGS) {
    const langTable = ITEM_NAMES[lang]
    if (!langTable) {
      console.warn(`[generate-audio] no items for language "${lang}" — skipping`)
      continue
    }
    for (const [pack, items] of Object.entries(langTable)) {
      const packDir = join(OUT_ROOT, lang, pack)
      await mkdir(packDir, { recursive: true })
      for (const [letter, word] of Object.entries(items)) {
        const outPath = join(packDir, `${letter}.mp3`)
        if (!FORCE && (await fileExists(outPath))) {
          skipped++
          continue
        }
        const phrase = buildMainPhrase(word, lang, pack)
        try {
          const buf = await fetchPronunciation(phrase, lang)
          await writeFile(outPath, buf)
          done++
          console.log(
            `  ✓ ${lang}/${pack}/${letter}.mp3  "${phrase}"  (${buf.length} bytes)`
          )
          // Gentle pacing — keeps the server-side token from being rotated
          // mid-batch and is friendly to ElevenLabs rate limits.
          await sleep(200)
        } catch (e) {
          failed++
          console.error(`  ✗ ${lang}/${pack}/${letter}.mp3  ${e.message}`)
        }
      }
    }
  }

  // ── Extra non-pack phrases (e.g. the celebration praise) ────────────────
  for (const [slug, byLang] of Object.entries(EXTRAS)) {
    const dir = join(projectRoot, 'public', 'audio', slug)
    await mkdir(dir, { recursive: true })
    for (const lang of LANGS) {
      const phrase = byLang[lang]
      if (!phrase) continue
      const outPath = join(dir, `${lang}.mp3`)
      if (!FORCE && (await fileExists(outPath))) {
        skipped++
        continue
      }
      try {
        const buf = await fetchPronunciation(phrase, lang)
        await writeFile(outPath, buf)
        done++
        console.log(`  ✓ ${slug}/${lang}.mp3  "${phrase}"  (${buf.length} bytes)`)
        await sleep(200)
      } catch (e) {
        failed++
        console.error(`  ✗ ${slug}/${lang}.mp3  ${e.message}`)
      }
    }
  }

  console.log(
    `\n[generate-audio] wrote=${done}  skipped=${skipped}  failed=${failed}`
  )
  if (skipped > 0 && !FORCE) {
    console.log('[generate-audio] (re-run with FORCE=1 to overwrite existing files)')
  }
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('[generate-audio] fatal:', e?.message || e)
  process.exit(1)
})
