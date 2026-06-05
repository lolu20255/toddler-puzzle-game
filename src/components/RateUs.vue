<script setup>
/**
 * Rate-us overlay. The "loud" entry point into the in-app review flow,
 * triggered automatically after a strong play moment (a level complete).
 *
 * The always-available secondary entry is the small card in the Phaser
 * Settings scene (`buildRateUsCard()` in `src/game/scenes/Settings.js`) —
 * this overlay is more invasive on purpose because it surfaces at the
 * peak emotional moment of the gameplay loop.
 *
 * Event protocol:
 *   - Listens for `EventBus.emit('rate-us:check')`
 *       → runs the gating rules in `shouldPrompt()` and, if they pass,
 *         opens the overlay and bumps the prompt count.
 *   - Listens for `EventBus.emit('rate-us:open')`
 *       → opens unconditionally (used by debug menus / tests).
 *   - Emits `EventBus.emit('rate-us:closed', { rated })` on close.
 *
 * Gating rules — keep generous to avoid annoying parents:
 *   - Skip if `rateUsRated === true`               (one-time only)
 *   - Skip if `rateUsPromptCount >= 3`             (give up after 3)
 *   - Skip if `Date.now() - rateUsDismissedAt < 3 days`
 *   - Skip if `puzzlesCompleted < 3`               (no first-puzzle ask)
 *
 * Safety: if `InAppReview.requestReview()` throws or hangs, the overlay
 * auto-dismisses after 8s so a broken plugin can't lock the UI.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { InAppReview } from '@capacitor-community/in-app-review'
import { EventBus } from '../game/EventBus'
import { settings } from '../services/settings'
import { isNativePlatform } from '../services/platform'

const MAX_PROMPTS = 3
const MIN_PUZZLES_BEFORE_PROMPT = 3
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
const NATIVE_PROMPT_TIMEOUT_MS = 8000

const open = ref(false)
const submitting = ref(false)

let nativeTimeoutId = null
let didRate = false

// ─── EventBus wiring ──────────────────────────────────────────────────
function shouldPrompt() {
  if (settings.rateUsRated()) return false
  if (settings.rateUsPromptCount() >= MAX_PROMPTS) return false
  const dismissedAt = settings.rateUsDismissedAt()
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return false
  if (settings.puzzlesCompleted() < MIN_PUZZLES_BEFORE_PROMPT) return false
  return true
}

async function onCheck() {
  if (open.value) return
  if (!shouldPrompt()) return
  // Bump the prompt count BEFORE showing so a closed/crashed app on the
  // very next launch still treats this as a shown prompt.
  await settings.setRateUsPromptCount(settings.rateUsPromptCount() + 1)
  didRate = false
  open.value = true
}

function onOpenForce() {
  // Debug / test entry — skip gating but still bump the count so we don't
  // double-prompt in the same session.
  if (open.value) return
  didRate = false
  open.value = true
}

onMounted(() => {
  EventBus.on('rate-us:check', onCheck)
  EventBus.on('rate-us:open', onOpenForce)
})
onUnmounted(() => {
  EventBus.off('rate-us:check', onCheck)
  EventBus.off('rate-us:open', onOpenForce)
  if (nativeTimeoutId) {
    clearTimeout(nativeTimeoutId)
    nativeTimeoutId = null
  }
})

// ─── Actions ──────────────────────────────────────────────────────────
async function close({ rated = false, dismissedAt = null } = {}) {
  if (nativeTimeoutId) {
    clearTimeout(nativeTimeoutId)
    nativeTimeoutId = null
  }
  submitting.value = false
  open.value = false
  if (rated) {
    didRate = true
    await settings.setRateUsRated(true)
  } else if (dismissedAt != null) {
    await settings.setRateUsDismissedAt(dismissedAt)
  }
  EventBus.emit('rate-us:closed', { rated: didRate })
}

async function onRate() {
  if (submitting.value) return
  submitting.value = true

  // Safety net: if requestReview throws OR the OS-controlled dialog
  // never resolves (the iOS prompt never resolves a Promise), close
  // ourselves after a few seconds so the toddler can keep playing.
  nativeTimeoutId = setTimeout(() => {
    close({ rated: true })
  }, NATIVE_PROMPT_TIMEOUT_MS)

  try {
    if (isNativePlatform()) {
      await InAppReview.requestReview()
    } else {
      // Web preview / dev — pretend we showed the OS dialog instantly so
      // the flow still feels responsive in the browser.
      await new Promise((r) => setTimeout(r, 600))
    }
    // The OS prompt never tells us if the user actually rated, so we
    // optimistically mark as rated to avoid bugging the parent again.
    close({ rated: true })
  } catch (error) {
    console.error('[RateUs] requestReview error:', error)
    // Treat as "rated" anyway — never prompt again after a failure to
    // avoid trapping the parent in a broken loop.
    close({ rated: true })
  }
}

function onMaybeLater() {
  close({ dismissedAt: Date.now() })
}

async function onDontAskAgain() {
  // Mark as rated → suppresses forever. (We don't want a separate "never
  // ask" key; "rated" semantically covers "stop asking".)
  close({ rated: true })
}

function onCloseX() {
  // X is treated like "Maybe later" — keep options open for next time.
  close({ dismissedAt: Date.now() })
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[9997] overflow-hidden font-fredoka"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-us-title"
      aria-describedby="rate-us-body"
    >
      <!-- Sky-blue gradient base — picks up the in-game world so the prompt
           feels like part of the celebration, not a marketing chrome. -->
      <div class="absolute inset-0 bg-gradient-to-b from-[#5bb6ef] via-[#92cef1] to-[#fff8e7]" />

      <!-- Drifting clouds — same puffy 3-circle silhouette used in
           Onboarding / Paywall so all three overlays read as one world. -->
      <div aria-hidden="true" class="pointer-events-none absolute top-16 left-6 h-10 w-20">
        <div class="absolute left-0 top-1 h-7 w-9 rounded-full bg-white/95" />
        <div class="absolute left-5 top-0 h-9 w-12 rounded-full bg-white/95" />
        <div class="absolute left-12 top-2 h-7 w-9 rounded-full bg-white/95" />
      </div>
      <div aria-hidden="true" class="pointer-events-none absolute top-32 right-4 h-8 w-16">
        <div class="absolute left-0 top-1 h-5 w-7 rounded-full bg-white/90" />
        <div class="absolute left-4 top-0 h-7 w-9 rounded-full bg-white/90" />
        <div class="absolute left-9 top-1 h-5 w-7 rounded-full bg-white/90" />
      </div>
      <div aria-hidden="true" class="pointer-events-none absolute top-1/2 left-2 h-9 w-20">
        <div class="absolute left-0 top-1 h-6 w-8 rounded-full bg-white/85" />
        <div class="absolute left-4 top-0 h-8 w-11 rounded-full bg-white/85" />
        <div class="absolute left-11 top-2 h-6 w-7 rounded-full bg-white/85" />
      </div>

      <!-- Twinkling sparkles in the negative space. Pure CSS keyframes. -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0">
        <span
          class="absolute right-10 top-24 text-base text-sunshine animate-twinkle"
          style="animation-delay: 0s"
        >✦</span>
        <span
          class="absolute left-12 top-40 text-sm text-white animate-twinkle"
          style="animation-delay: 0.6s"
        >✦</span>
        <span
          class="absolute right-24 top-1/2 text-xs text-sunshine animate-twinkle"
          style="animation-delay: 1.2s"
        >✦</span>
        <span
          class="absolute left-1/3 top-1/4 text-base text-white animate-twinkle"
          style="animation-delay: 0.4s"
        >✦</span>
      </div>

      <!-- Content stack — fills viewport, content centred -->
      <div
        class="relative flex h-full w-full flex-col px-6"
        :style="{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
        }"
      >
        <!-- Top row: close X -->
        <div class="flex justify-end">
          <button
            type="button"
            aria-label="Close"
            class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-coral/60 bg-white/95 text-lg font-bold text-warm shadow-sm transition-transform active:scale-95"
            @click="onCloseX"
          >
            ✕
          </button>
        </div>

        <!-- Hero card -->
        <div class="flex flex-1 flex-col items-center justify-center text-center">
          <!-- Sun mascot — same SVG as Onboarding/Paywall so the moment
               reads as continuous with the rest of the world. -->
          <div
            aria-hidden="true"
            class="relative h-32 w-32 animate-drift-y"
          >
            <svg viewBox="0 0 100 100" class="h-full w-full overflow-visible">
              <g class="animate-spin-slow" style="transform-origin: 50px 50px;">
                <g fill="#ffd23f">
                  <polygon points="50,4 46,22 54,22" />
                  <polygon points="50,96 46,78 54,78" />
                  <polygon points="4,50 22,46 22,54" />
                  <polygon points="96,50 78,46 78,54" />
                  <polygon points="17,17 28,28 22,34 11,23" />
                  <polygon points="83,17 72,28 78,34 89,23" />
                  <polygon points="17,83 28,72 34,78 23,89" />
                  <polygon points="83,83 72,72 78,66 89,77" />
                </g>
              </g>
              <circle cx="50" cy="50" r="24" fill="#ffd23f" />
              <circle cx="44" cy="44" r="10" fill="#ffe78a" opacity="0.7" />
              <!-- Big happy smile -->
              <circle cx="41" cy="48" r="3" fill="#c9821b" />
              <circle cx="59" cy="48" r="3" fill="#c9821b" />
              <path
                d="M 40 55 Q 50 66 60 55"
                stroke="#c9821b"
                stroke-width="3"
                fill="none"
                stroke-linecap="round"
              />
            </svg>
          </div>

          <!-- Animated 5-star row — staggered twinkles to feel alive. -->
          <div
            class="mt-6 flex items-center justify-center gap-2"
            role="img"
            aria-label="Five stars"
          >
            <span
              v-for="(delay, i) in [0, 0.15, 0.3, 0.45, 0.6]"
              :key="i"
              class="text-4xl text-sunshine animate-twinkle"
              :style="{
                animationDelay: `${delay}s`,
                textShadow: '0 2px 0 #c99e00, 0 4px 6px rgba(0,0,0,0.18)'
              }"
              aria-hidden="true"
            >
              ★
            </span>
          </div>

          <h1
            id="rate-us-title"
            class="mt-6 text-3xl font-bold leading-tight text-royal"
            style="text-shadow: 0 1px 0 #fff"
          >
            Loving Puzzle Pals?
          </h1>

          <p
            id="rate-us-body"
            class="mt-3 max-w-sm text-base leading-snug text-warmInk"
          >
            If your little one is enjoying it, a quick rating helps other
            parents find us
            <span aria-hidden="true">💛</span>
          </p>
        </div>

        <!-- CTAs anchored to the bottom -->
        <div class="pt-4">
          <!-- Primary -->
          <button
            type="button"
            :disabled="submitting"
            class="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-coral to-coralDark text-lg font-bold text-white shadow-chunkySm transition-transform active:scale-[0.98] disabled:opacity-60"
            style="text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3)"
            @click="onRate"
          >
            <span aria-hidden="true">★</span>
            <span>{{ submitting ? 'Opening…' : 'Rate the app' }}</span>
          </button>

          <!-- Secondary -->
          <button
            type="button"
            :disabled="submitting"
            class="mt-3 h-12 w-full rounded-full border-2 border-coral/60 bg-white/95 text-base font-bold text-warm shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            @click="onMaybeLater"
          >
            Maybe later
          </button>

          <!-- Tertiary "don't ask again" -->
          <div class="mt-3 flex justify-center">
            <button
              type="button"
              :disabled="submitting"
              class="text-xs font-semibold text-warm/70 underline-offset-2 hover:underline disabled:opacity-50"
              @click="onDontAskAgain"
            >
              Don't ask again
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
