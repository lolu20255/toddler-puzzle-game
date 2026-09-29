<script setup>
/**
 * Animated launch intro, modelled on the ReadLens splash hand-off.
 *
 * The native splash is a flat SPLASH_BG fill, identical to this component's
 * first frame, so hiding it after the first paint never flashes. Then four
 * puzzle pieces fly in from the corners and snap together, the smiley pops
 * in the middle and winks, and the wordmark bounces up letter by letter.
 * The intro holds until the game behind it is ready (menu or onboarding),
 * then fades away.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { SplashScreen } from '@capacitor/splash-screen'
import { EventBus } from '../game/EventBus'
import { settings } from '../services/settings'
import { isNativePlatform } from '../services/platform'
import { prepareViewport } from '../game/viewport'

const SPLASH_BG = '#6a5ae0' // Must match capacitor.config.json SplashScreen.backgroundColor and assets/splash.png.
const MIN_SHOW_MS = 2600 // The full animation reads at this point.
const MAX_WAIT_MS = 7000 // Never hold a slow device on the intro forever.
const REDUCED_MOTION_MS = 900
const EXIT_MS = 480
const PIECE_SIZE = 100
const PIECE_RADIUS = 18
const KNOB_RADIUS = 15
const KNOB_NECK = 11
const OUTLINE = '#2d2670'
const WORDMARK = 'Puzzle Pals'
const TAGLINES = { en: 'Learn · Play · Grow', es: 'Aprende · Juega · Crece' }
const PIECES = [
  { id: 'orange', x: 14, y: 14, fill: '#ff9f1c', lip: '#c96f00', sides: [0, 1, -1, 0], from: [-190, -230], rot: -38 },
  { id: 'pink', x: 126, y: 14, fill: '#ff5da2', lip: '#c73a78', sides: [0, 0, 1, -1], from: [200, -220], rot: 34 },
  { id: 'indigo', x: 126, y: 126, fill: '#5b6cff', lip: '#3a45c4', sides: [-1, 0, 0, 1], from: [210, 230], rot: -30 },
  { id: 'green', x: 14, y: 126, fill: '#5fc34a', lip: '#3d8c2f', sides: [1, -1, 0, 0], from: [-200, 220], rot: 40 }
]
const SPARKS = Array.from({ length: 10 }, (_, index) => index)
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const visible = ref(true)
const leaving = ref(false)
const language = ref(settings.language())
const letters = computed(() => WORDMARK.split(''))
const tagline = computed(() => TAGLINES[language.value] || TAGLINES.en)
const pieces = PIECES.map((piece) => ({ ...piece, path: piecePath(piece.x, piece.y, piece.sides) }))

let gameReady = false
let minTimeDone = false
let timers = []

/**
 * Rounded square with a knob (1), notch (-1) or flat edge (0) at the middle
 * of each side, listed clockwise from the top. Traversal is clockwise, so an
 * arc with sweep 1 bulges outwards and sweep 0 cuts inwards.
 */
function piecePath(x, y, sides) {
  const size = PIECE_SIZE
  const radius = PIECE_RADIUS
  const edges = [
    { mid: [x + size / 2, y], dir: [1, 0], corner: [x + size, y + radius], cornerStart: [x + size - radius, y] },
    { mid: [x + size, y + size / 2], dir: [0, 1], corner: [x + size - radius, y + size], cornerStart: [x + size, y + size - radius] },
    { mid: [x + size / 2, y + size], dir: [-1, 0], corner: [x, y + size - radius], cornerStart: [x + radius, y + size] },
    { mid: [x, y + size / 2], dir: [0, -1], corner: [x + radius, y], cornerStart: [x, y + radius] }
  ]
  let path = `M ${x + radius} ${y}`
  edges.forEach((edge, index) => {
    path += edgeFeature(edge, sides[index])
    path += ` L ${edge.cornerStart.join(' ')} A ${radius} ${radius} 0 0 1 ${edge.corner.join(' ')}`
  })
  return `${path} Z`
}

function edgeFeature(edge, kind) {
  if (kind === 0) return ''
  const [midX, midY] = edge.mid
  const [dirX, dirY] = edge.dir
  const sweep = kind > 0 ? 1 : 0
  const start = `${midX - dirX * KNOB_NECK} ${midY - dirY * KNOB_NECK}`
  const end = `${midX + dirX * KNOB_NECK} ${midY + dirY * KNOB_NECK}`
  return ` L ${start} A ${KNOB_RADIUS} ${KNOB_RADIUS} 0 1 ${sweep} ${end}`
}

function pieceStyle(piece, index) {
  return {
    '--from-x': `${piece.from[0]}px`,
    '--from-y': `${piece.from[1]}px`,
    '--rot': `${piece.rot}deg`,
    '--delay': `${180 + index * 90}ms`
  }
}

function hideNativeSplash() {
  if (!isNativePlatform()) return
  SplashScreen.hide({ fadeOutDuration: 0 }).catch((error) => console.warn('[Splash] hide failed', error))
}

function leaveWhenReady() {
  if (!gameReady || !minTimeDone || leaving.value) return
  leaving.value = true
  timers.push(setTimeout(() => (visible.value = false), EXIT_MS))
}

function markGameReady() {
  gameReady = true
  leaveWhenReady()
}

onMounted(() => {
  // Wait for the iOS edge-to-edge switch, then two frames: the first commits
  // the layout, the second guarantees the intro's first frame is painted.
  prepareViewport().then(() => requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash)))
  settings.load().then(() => (language.value = settings.language()))
  EventBus.once('current-scene-ready', markGameReady)
  EventBus.once('onboarding:open', markGameReady)
  timers.push(
    setTimeout(() => {
      minTimeDone = true
      leaveWhenReady()
    }, reducedMotion ? REDUCED_MOTION_MS : MIN_SHOW_MS),
    setTimeout(markGameReady, MAX_WAIT_MS)
  )
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  EventBus.off('current-scene-ready', markGameReady)
  EventBus.off('onboarding:open', markGameReady)
})
</script>

<template>
  <div
    v-if="visible"
    class="splash"
    :class="{ 'splash--leaving': leaving, 'splash--still': reducedMotion }"
    :style="{ '--splash-bg': SPLASH_BG }"
    aria-hidden="true"
  >
    <div class="splash__glow splash__glow--center"></div>
    <div class="splash__glow splash__glow--sky"></div>
    <span v-for="spark in 14" :key="`twinkle-${spark}`" class="splash__twinkle" :style="{ '--i': spark }"></span>

    <div class="splash__content">
      <svg class="splash__mark" viewBox="-20 -20 280 280" role="img">
        <circle class="splash__ring" cx="120" cy="120" r="118" />
        <g v-for="(piece, index) in pieces" :key="piece.id" class="splash__piece" :style="pieceStyle(piece, index)">
          <path :d="piece.path" :fill="piece.lip" transform="translate(0 7)" />
          <path :d="piece.path" :fill="piece.fill" :stroke="OUTLINE" stroke-width="5" stroke-linejoin="round" />
          <ellipse :cx="piece.x + 36" :cy="piece.y + 24" rx="24" ry="11" fill="#fff" opacity="0.28" />
        </g>
        <g class="splash__glyphs">
          <text x="62" y="84" class="splash__glyph">A</text>
          <text x="176" y="84" class="splash__glyph">1</text>
          <g transform="translate(62 176)">
            <circle r="19" fill="#fff" :stroke="OUTLINE" stroke-width="4.5" />
            <path d="M -18 -4 Q 0 6 18 -4 M -4 -18 Q 6 0 -4 18" fill="none" :stroke="OUTLINE" stroke-width="3.5" stroke-linecap="round" />
          </g>
          <path
            d="M 176 158 V 194 M 158 176 H 194"
            :stroke="OUTLINE"
            stroke-width="17"
            stroke-linecap="round"
          />
          <path d="M 176 158 V 194 M 158 176 H 194" stroke="#fff" stroke-width="9" stroke-linecap="round" />
        </g>
        <g class="splash__smiley">
          <circle cx="120" cy="120" r="31" fill="#ffd23f" :stroke="OUTLINE" stroke-width="5" />
          <ellipse cx="108" cy="113" rx="4.2" ry="5.6" :fill="OUTLINE" />
          <ellipse class="splash__wink" cx="132" cy="113" rx="4.2" ry="5.6" :fill="OUTLINE" />
          <path d="M 105 126 Q 120 140 135 126" fill="none" :stroke="OUTLINE" stroke-width="4.5" stroke-linecap="round" />
          <ellipse cx="111" cy="102" rx="9" ry="4.5" fill="#fff" opacity="0.45" />
        </g>
        <g class="splash__sparks">
          <path
            v-for="spark in SPARKS"
            :key="`spark-${spark}`"
            class="splash__spark"
            :style="{ '--angle': `${spark * 36}deg` }"
            d="M 120 112 L 122.5 117.5 L 128 120 L 122.5 122.5 L 120 128 L 117.5 122.5 L 112 120 L 117.5 117.5 Z"
            :fill="spark % 2 ? '#ffd23f' : '#ffffff'"
          />
        </g>
      </svg>

      <div class="splash__words">
        <p class="splash__eyebrow">ABC KIDS</p>
        <h1 class="splash__title">
          <span
            v-for="(letter, index) in letters"
            :key="index"
            class="splash__letter"
            :style="{ '--i': index }"
          >{{ letter === ' ' ? ' ' : letter }}</span>
        </h1>
        <p class="splash__tagline">{{ tagline }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--splash-bg);
  font-family: 'Fredoka', 'Arial Rounded MT Bold', sans-serif;
  touch-action: none;
}

.splash--leaving {
  animation: splash-out 480ms cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

.splash--leaving .splash__content {
  animation: content-out 480ms cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

.splash__glow {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  animation: glow-in 900ms ease-out 60ms forwards;
}

.splash__glow--center {
  width: 150vmax;
  height: 150vmax;
  background: radial-gradient(circle, rgba(160, 146, 255, 0.85) 0%, rgba(160, 146, 255, 0) 55%);
}

.splash__glow--sky {
  width: 120vmax;
  height: 120vmax;
  right: -60vmax;
  bottom: -60vmax;
  background: radial-gradient(circle, rgba(91, 182, 239, 0.75) 0%, rgba(91, 182, 239, 0) 60%);
  animation-delay: 200ms;
}

.splash__twinkle {
  position: absolute;
  left: calc(((var(--i) * 37) % 100) * 1%);
  top: calc(((var(--i) * 61) % 100) * 1%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
  opacity: 0;
  animation: twinkle 1800ms ease-in-out calc(300ms + var(--i) * 110ms) infinite;
}

.splash__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.splash__mark {
  width: min(58vw, 34vh, 280px);
  height: auto;
  overflow: visible;
}

.splash__piece {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: piece-in 760ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay) forwards;
}

.splash__glyphs {
  opacity: 0;
  animation: fade-in 260ms ease-out 900ms forwards;
}

.splash__glyph {
  font-size: 50px;
  font-weight: 700;
  fill: #fff;
  stroke: #2d2670;
  stroke-width: 4.5px;
  paint-order: stroke;
  text-anchor: middle;
}

.splash__smiley {
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  animation: smiley-in 620ms cubic-bezier(0.34, 1.56, 0.64, 1) 1000ms forwards;
}

.splash__wink {
  transform-box: fill-box;
  transform-origin: center;
  animation: wink 260ms ease-in-out 1950ms;
}

.splash__ring {
  fill: none;
  stroke: #fff;
  stroke-width: 6;
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: ring 700ms ease-out 960ms;
}

.splash__spark {
  transform-box: view-box;
  transform-origin: 120px 120px;
  opacity: 0;
  animation: spark 720ms cubic-bezier(0.22, 1, 0.36, 1) 980ms;
}

.splash__words {
  margin-top: 18px;
  text-align: center;
}

.splash__eyebrow {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.34em;
  color: #ffd23f;
  opacity: 0;
  animation: rise-in 520ms cubic-bezier(0.22, 1, 0.36, 1) 1150ms forwards;
}

.splash__title {
  margin: 2px 0 0;
  font-size: clamp(40px, 11vw, 60px);
  font-weight: 700;
  line-height: 1.05;
  color: #fff;
  text-shadow: 0 4px 0 rgba(36, 22, 120, 0.35), 0 10px 24px rgba(36, 22, 120, 0.3);
}

.splash__letter {
  display: inline-block;
  opacity: 0;
  animation: letter-in 560ms cubic-bezier(0.34, 1.56, 0.64, 1) calc(1220ms + var(--i) * 45ms) forwards;
}

.splash__tagline {
  margin: 10px 0 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.82);
  opacity: 0;
  animation: rise-in 600ms cubic-bezier(0.22, 1, 0.36, 1) 1750ms forwards;
}

/* Reduced motion: show the finished composition at once, then fade. */
.splash--still .splash__piece,
.splash--still .splash__glyphs,
.splash--still .splash__eyebrow,
.splash--still .splash__letter,
.splash--still .splash__tagline,
.splash--still .splash__glow {
  animation: none;
  opacity: 1;
  transform: none;
}

.splash--still .splash__smiley {
  animation: none;
  transform: none;
}

.splash--still .splash__twinkle,
.splash--still .splash__ring,
.splash--still .splash__spark,
.splash--still .splash__wink {
  animation: none;
}

@keyframes piece-in {
  0% {
    opacity: 0;
    transform: translate(var(--from-x), var(--from-y)) rotate(var(--rot)) scale(0.55);
  }
  25% {
    opacity: 1;
  }
  70% {
    transform: translate(0, 0) rotate(0) scale(1.06);
  }
  84% {
    transform: scale(0.97, 1.03);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes smiley-in {
  0% {
    transform: scale(0) rotate(-35deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

@keyframes wink {
  50% {
    transform: scaleY(0.1);
  }
}

@keyframes ring {
  0% {
    opacity: 0.8;
    transform: scale(0.55);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

@keyframes spark {
  0% {
    opacity: 1;
    transform: rotate(var(--angle)) translateY(0) scale(0.4);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-150px) scale(1.3);
  }
}

@keyframes letter-in {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.5);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes rise-in {
  0% {
    opacity: 0;
    transform: translateY(14px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-in {
  to {
    opacity: 1;
  }
}

@keyframes glow-in {
  to {
    opacity: 1;
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4);
  }
  50% {
    opacity: 0.9;
    transform: scale(1);
  }
}

@keyframes content-out {
  to {
    transform: scale(1.12);
  }
}

@keyframes splash-out {
  to {
    opacity: 0;
  }
}
</style>
