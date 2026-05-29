import { nameForAssetKey } from './itemNames'
import { preload } from '../services/libro/pronunciation'
import { preloadLevelAudio } from '../services/libro/levelAudio'
import { settings } from '../services/settings'

/**
 * Praise phrase — combines "good job" with the toddler's name when set.
 * Falls back to just the praise if the parent hasn't entered a name.
 *
 * This is audio 2 of the celebration. Cache key = name + lang, so once it's
 * generated for "Logan" in English it persists in IndexedDB and replays
 * instantly on every subsequent match — no network call after the first.
 */
function buildPraisePhrase(lang) {
  const name = settings.toddlerName()
  if (lang === 'es') return name ? `Muy bien ${name}!` : 'Muy bien!'
  return name ? `Good job ${name}!` : 'Good job!'
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
export function showCelebration(scene, assetKey, onDismissed) {
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
      if (!modal.scene) {
        // Modal was already destroyed (a newer match replaced it). The
        // caller's dismiss callback should still fire — otherwise a final-
        // match handoff that's waiting on this modal would never get the
        // level-complete trigger.
        if (typeof onDismissed === 'function') onDismissed()
        return
      }
      scene.tweens.add({
        targets: modal,
        scale: 0,
        alpha: 0,
        duration: 280,
        ease: 'Back.in',
        onComplete: () => {
          modal.destroy()
          if (scene._celebrationModal === modal) scene._celebrationModal = null
          if (typeof onDismissed === 'function') onDismissed()
        }
      })
    })
  }

  // Kick off the two parallel audio fetches and orchestrate playback +
  // letter reveal. Anything that fails falls back to visual-only timing.
  // Audio 1 — spelling + pronunciation only ("A, P, P, L, E. APPLE!").
  // - the trick to make spanish spelling good was to add " ¡¡¡ " before the word and " !!! " after the word
  // Audio 2 — praise + name combined ("Good job Logan!"). 
  ;(async () => {
    // Audio 1 — the spelling+pronunciation. Routed through `preloadLevelAudio`
    // which first tries the bundled MP3 (`public/audio/levels/<lang>/<pack>/
    // <letter>.mp3`, pre-generated via `npm run generate:audio`), and only
    // falls back to the API if the file is missing for this asset.
    // Audio 2 — per-toddler "Good job <Name>!" praise. Always goes through
    // `preload()` since the name is unique per device.
    const praisePhrase = buildPraisePhrase(lang)
    // Kick both fetches off in parallel, but DON'T await them together —
    // in airplane mode the bundled main audio resolves instantly while the
    // praise audio has to hit the API and fail, which used to delay the
    // entire celebration by up to the axios timeout (10s). Awaiting them
    // independently lets the spelling start the moment the bundle returns.
    const praisePromise = preload(praisePhrase, lang)
    const mainAudio = await preloadLevelAudio(assetKey, lang)

    if (!modal.scene) return // a newer match already destroyed us

    if (mainAudio) {
      await _audioReady(mainAudio)
      const mainMs =
        mainAudio.duration > 0 ? mainAudio.duration * 1000 : assetName.length * 700

      // Audio 1 is now spelling + word only (no praise). The spelling fills
      // a bigger share of the runtime than before — recompute the letter-
      // reveal cadence accordingly so the visual pops line up with the TTS.
      // Heuristic: each spelled letter ≈ 1 syllable, the word ≈ 0.4 syllables
      // per character.
      const spellSyl = assetName.length
      const wordSyl = Math.max(assetName.length * 0.4, 1)
      const spellingFraction = spellSyl / (spellSyl + wordSyl)
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

      // Chain the praise to start the instant audio 1 ends — sounds like one
      // continuous sentence: "…APPLE! Good job Logan!"
      // The praise fetch is awaited HERE (after main has already started)
      // so we don't block the spelling on it. If we're offline and the
      // praise fetch fails, this awaits null and we just skip the chain.
      const praiseAudio = await praisePromise
      let totalAudioMs = startDelay + mainMs
      if (praiseAudio) {
        await _audioReady(praiseAudio)
        const praiseMs =
          praiseAudio.duration > 0 ? praiseAudio.duration * 1000 : 1200
        const playPraise = () => {
          if (!modal.scene) return
          praiseAudio.currentTime = 0
          praiseAudio.play().catch(() => {})
        }
        // If main already finished while praise was loading, play praise now;
        // otherwise queue it to fire the instant main ends.
        if (mainAudio.ended) playPraise()
        else mainAudio.addEventListener('ended', playPraise, { once: true })
        totalAudioMs += praiseMs
      }
      scheduleDismiss(totalAudioMs + 600)
    } else {
      // ─── Fallback: main audio unavailable ───────────────────────────────
      // Reveal at a fixed interval. If we got the praise audio, play it after
      // the visual reveal as a tiny consolation.
      const perLetterMs = 280
      for (let i = 0; i < assetName.length; i++) {
        scene.time.delayedCall(360 + i * perLetterMs, () => revealLetter(i))
      }
      const visualEnd = 360 + assetName.length * perLetterMs
      if (praiseAudio) {
        await _audioReady(praiseAudio)
        const praiseMs =
          praiseAudio.duration > 0 ? praiseAudio.duration * 1000 : 1200
        scene.time.delayedCall(visualEnd + 200, () => {
          if (!modal.scene) return
          praiseAudio.currentTime = 0
          praiseAudio.play().catch(() => {})
        })
        scheduleDismiss(visualEnd + 200 + praiseMs + 600)
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
