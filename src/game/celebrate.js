import { nameForAssetKey } from './itemNames'
import { preload } from '../services/libro/pronunciation'
import { settings } from '../services/settings'

/**
 * Generic praise (no name) — said by audio 1. The child's name plays as
 * its own short audio 2 so:
 *   - audio 1 stays cacheable across every child (same word + same language
 *     ⇒ same MP3 returned + cached on the backend AND in our in-memory map).
 *   - audio 2 is a tiny per-name MP3, fetched once per child, replayed for
 *     every match.
 */
function buildPraise(lang) {
  return lang === 'es' ? 'Muy bien!' : 'Good job!'
}

/** Standalone "name" phrase — null if the parent hasn't set a name. */
function buildNamePhrase(lang) {
  const name = settings.toddlerName()
  if (!name) return null
  // Leading period gives the TTS a brief beat before the name, so when audio
  // 2 plays the instant audio 1 ends it feels like one continuous sentence.
  return lang === 'es' ? `${name}!` : `${name}!`
}

/**
 * Pop a celebratory modal when a toddler matches a piece.
 *
 * Two TTS audios are fetched in parallel from libro-ai:
 *   1. The **spelling** — "M, A, N, G, O" — used to drive the letter-reveal
 *      timing in the modal: each letter pops the moment the TTS speaks it,
 *      derived from the audio's actual `duration`.
 *   2. The **word + praise** — "MANGO. Good job Logan!" — chained to play
 *      the instant the spelling audio finishes.
 *
 * Audio-driven timing means the visual reveal stays in sync no matter how
 * fast or slow the TTS speaks. If the API is unavailable, the reveal falls
 * back to a fixed-interval visual-only animation so the celebration never
 * breaks.
 *
 * Only one celebration shows at a time — a new match replaces an older one.
 */
export function showCelebration(scene, assetKey) {
  const lang = settings.language()
  const assetName = nameForAssetKey(assetKey, lang)

  if (!assetName) return null
  if (scene._celebrationModal) {
    scene._celebrationModal.destroy()
    scene._celebrationModal = null
  }

  const sW = scene.sWidth
  const sH = scene.sHeight
  const minSide = Math.min(sW, sH)
  const modal = scene.add.container(sW / 2, sH / 2).setDepth(100)
  
  scene._celebrationModal = modal

  // Dimmed backdrop — not interactive, so the game keeps responding to drags.
  const dim = scene.add
    .rectangle(0, 0, sW * 1.2, sH * 1.2, 0x000000, 0.45)
    .setOrigin(0.5)
  modal.add(dim)

  // Card body — sunny yellow, with a 3-D lip and soft drop shadow.
  const cardW = Math.min(sW * 0.85, minSide * 1.05)
  const cardH = cardW * 0.85
  const radius = cardH * 0.13

  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.3)
  g.fillRoundedRect(-cardW / 2, -cardH / 2 + cardH * 0.06, cardW, cardH, radius)
  g.fillStyle(0xe8881c, 1)
  g.fillRoundedRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, radius)
  g.fillStyle(0xffce3a, 1)
  g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, radius)
  g.fillStyle(0xffffff, 0.3)
  g.fillRoundedRect(
    -cardW / 2 + cardW * 0.06,
    -cardH / 2 + cardH * 0.06,
    cardW * 0.88,
    cardH * 0.27,
    radius * 0.7
  )
  modal.add(g)

  // White window with the matched piece's picture.
  const winR = cardH * 0.21
  const iconY = -cardH * 0.18
  const win = scene.add
    .circle(0, iconY, winR, 0xffffff)
    .setStrokeStyle(Math.max(3, winR * 0.07), 0xe8881c, 0.5)
  modal.add(win)

  const icon = scene.add.image(0, iconY, assetKey)
  const iconScale = (winR * 1.5) / Math.max(icon.width, icon.height || icon.width)
  icon.setScale(iconScale)
  modal.add(icon)

  // The word — empty to start, filled one letter at a time.
  const letterSize = Math.min(
    cardH * 0.27,
    (cardW * 0.82) / Math.max(assetName.length * 0.65, 2.2)
  )
  const word = scene.add
    .text(0, cardH * 0.2, '', {
      fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
      fontSize: `${letterSize}px`,
      color: '#5a3a1a',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  word.setStroke('#ffffff', letterSize * 0.16)
  modal.add(word)

  // Entrance bounce.
  modal.setScale(0)
  scene.tweens.add({
    targets: modal,
    scale: 1,
    duration: 350,
    ease: 'Back.out'
  })

  // Bright UI chime when the card lands — an instant audible "yes!" before
  // the TTS audio arrives from the API.
  try {
    if (scene.cache.audio.exists('ui_celebrate')) {
      scene.sound.play('ui_celebrate', { volume: 0.55 })
    }
  } catch {
    /* audio is best-effort */
  }

  // Reveal a single letter — pop + sparkle + pitched UI click. Used both by
  // the audio-driven path (timing from spelling-audio duration) and by the
  // fallback path (fixed-interval).
  const revealLetter = (i) => {
    if (!word.scene) return
    word.setText(assetName.substring(0, i + 1))
    scene.tweens.add({
      targets: word,
      scale: { from: 1.22, to: 1 },
      duration: 200,
      ease: 'Back.out'
    })
    _sparkle(scene, modal, 0, cardH * 0.2, minSide)
    try {
      if (scene.cache.audio.exists('ui_letter_pop')) {
        const stride = assetName.length > 1 ? i / (assetName.length - 1) : 0.5
        const detune = -200 + stride * 600
        scene.sound.play('ui_letter_pop', { volume: 0.5, detune })
      }
    } catch {
      /* audio is best-effort */
    }
  }

  // Schedule the dismiss tween. Called once we know how long the full audio
  // sequence runs (or, in the fallback, a sensible default).
  const scheduleDismiss = (ms) => {
    scene.time.delayedCall(ms, () => {
      if (!modal.scene) return
      scene.tweens.add({
        targets: modal,
        scale: 0,
        alpha: 0,
        duration: 280,
        ease: 'Back.in',
        onComplete: () => {
          modal.destroy()
          if (scene._celebrationModal === modal) scene._celebrationModal = null
        }
      })
    })
  }

  // Kick off the two parallel audio fetches and orchestrate playback +
  // letter reveal. Anything that fails falls back to visual-only timing.
  ;(async () => {
    const spelledPhrase = assetName.split('').join(', ')
    // Audio 1 — generic, identical for every child playing this word+lang.
    // Cache hit rate is near-100% after the first child of each language has
    // heard each word once.
    const mainPhrase = `${spelledPhrase}. ${assetName}! ${buildPraise(lang)}`
    // Audio 2 — child-specific assetName only. `null` if no assetName is set, in which
    // case we just play audio 1 (which already ends in "Good job!" / "Muy bien!").
    const namePhrase = buildNamePhrase(lang)

    const [mainAudio, nameAudio] = await Promise.all([
      preload(mainPhrase, lang),
      namePhrase ? preload(namePhrase, lang) : Promise.resolve(null)
    ])

    if (!modal.scene) return // a newer match already destroyed us

    if (mainAudio) {
      await _audioReady(mainAudio)
      const mainMs =
        mainAudio.duration > 0 ? mainAudio.duration * 1000 : assetName.length * 700

      // Audio 1 contains spelling + word + praise; the spelling occupies
      // roughly the first half. Letter-reveal timing is derived from that
      // estimated portion — keeps the visual pops aligned with the actual
      // spoken letters without needing a separate spelling-only fetch.
      // Heuristic: each spelled letter ≈ 1 syllable, the word ≈ 0.4 syllables
      // per char, praise ≈ 2.5 syllables ("Good job") or 3 ("Muy bien").
      const spellSyl = assetName.length
      const wordSyl = Math.max(assetName.length * 0.4, 1)
      const praiseSyl = lang === 'es' ? 3 : 2.5
      const spellingFraction = spellSyl / (spellSyl + wordSyl + praiseSyl)
      const perLetterMs = (mainMs * spellingFraction) / assetName.length

      // Small head-start so the entrance pop doesn't clash with the first
      // spoken letter, then start audio + letter reveal together.
      const startDelay = 250
      scene.time.delayedCall(startDelay, () => {
        mainAudio.currentTime = 0
        mainAudio.play().catch(() => {})
      })
      // Each letter pops a touch earlier than the TTS hits the next one, so
      // the visual reads as leading the audio (feels more responsive).
      const visualLead = perLetterMs * 0.15
      for (let i = 0; i < assetName.length; i++) {
        const at = startDelay + i * perLetterMs - visualLead
        scene.time.delayedCall(Math.max(0, at), () => revealLetter(i))
      }

      // Chain the assetName to start the instant audio 1 ends — sounds like one
      // continuous sentence: "…Good job. Lucca!"
      let totalAudioMs = startDelay + mainMs
      if (nameAudio) {
        await _audioReady(nameAudio)
        const nameMs =
          nameAudio.duration > 0 ? nameAudio.duration * 1000 : 1000
        mainAudio.addEventListener(
          'ended',
          () => {
            if (!modal.scene) return
            nameAudio.currentTime = 0
            nameAudio.play().catch(() => {})
          },
          { once: true }
        )
        totalAudioMs += nameMs
      }
      scheduleDismiss(totalAudioMs + 600)
    } else {
      // ─── Fallback: main audio unavailable ───────────────────────────────
      // Reveal at a fixed interval. If we got the name audio, play it after
      // the visual reveal as a tiny consolation.
      const perLetterMs = 280
      for (let i = 0; i < assetName.length; i++) {
        scene.time.delayedCall(360 + i * perLetterMs, () => revealLetter(i))
      }
      const visualEnd = 360 + assetName.length * perLetterMs
      if (nameAudio) {
        await _audioReady(nameAudio)
        const nameMs =
          nameAudio.duration > 0 ? nameAudio.duration * 1000 : 1000
        scene.time.delayedCall(visualEnd + 200, () => {
          if (!modal.scene) return
          nameAudio.currentTime = 0
          nameAudio.play().catch(() => {})
        })
        scheduleDismiss(visualEnd + 200 + nameMs + 600)
      } else {
        scheduleDismiss(visualEnd + 1500)
      }
    }
  })()

  return modal
}

/** Resolve when the audio's metadata is ready (so `.duration` is reliable). */
function _audioReady(audio) {
  return new Promise((resolve) => {
    if (!Number.isNaN(audio.duration) && audio.duration > 0) return resolve()
    const onReady = () => {
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplay', onReady)
      resolve()
    }
    audio.addEventListener('loadedmetadata', onReady, { once: true })
    audio.addEventListener('canplay', onReady, { once: true })
    // Safety net — never block the celebration forever on metadata.
    setTimeout(() => {
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplay', onReady)
      resolve()
    }, 1500)
  })
}

function _sparkle(scene, parent, x, y, minSide) {
  const colors = [0xffd23f, 0xffffff, 0xff8fc7, 0x8be3ff]
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3
    const size = minSide * 0.018
    const star = scene.add.star(
      x,
      y,
      5,
      size * 0.45,
      size,
      colors[i % colors.length]
    )
    parent.add(star)
    const dist = minSide * 0.08
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      angle: 200,
      scale: 0,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => star.destroy()
    })
  }
}
