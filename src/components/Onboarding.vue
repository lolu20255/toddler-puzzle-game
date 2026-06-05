<script setup>
/**
 * Parent-facing 3-step onboarding. Captures the two settings that
 * otherwise hide in the cog menu (toddler's name + language) so the
 * first match the kid completes uses personalised "Good job <Name>!"
 * in the correct language.
 *
 *   1. Welcome     — mascot + value prop + Get Started
 *   2. Name        — text input + Skip
 *   3. Language    — English / Español pills + Continue
 *
 * Persisted: `settings.setOnboardingComplete(true)` on finish. Boot
 * checks this flag and emits `onboarding:open` only on first launch.
 * Devs can reset via Settings → Debug (when TESTING_FEATURES is on).
 *
 * Triggered from Boot via:
 *   EventBus.emit('onboarding:open')
 *
 * On finish, emits `onboarding:complete` so Boot can hand off to MainMenu.
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { EventBus } from '../game/EventBus'
import { settings } from '../services/settings'

const open = ref(false)
const step = ref(0) // 0 = welcome, 1 = name, 2 = language
const totalSteps = 3

const name = ref('')
const language = ref('en') // 'en' | 'es'

const nameInput = ref(null)

// Step index → human-readable name for analytics. Keeps the amplitude
// event ('welcome' / 'name' / 'language') decoupled from the integer step
// index that drives the v-if branches.
const STEP_NAMES = ['welcome', 'name', 'language']

// ─── EventBus wiring ──────────────────────────────────────────────────
const onOpen = () => {
  open.value = true
  step.value = 0
  // Pre-populate from existing settings (re-running the flow after a manual
  // reset shouldn't blow away values that were already set).
  name.value = settings.toddlerName() || ''
  language.value = settings.language() || 'en'
  // EventBus → Amplitude. Fire the first step view; subsequent step views
  // fire from `next()` as the parent advances.
  EventBus.emit('onboarding:step', { step: STEP_NAMES[0] })
}

onMounted(() => {
  EventBus.on('onboarding:open', onOpen)
})
onUnmounted(() => {
  EventBus.off('onboarding:open', onOpen)
})

// ─── Step navigation ──────────────────────────────────────────────────
async function next() {
  if (step.value < totalSteps - 1) {
    step.value++
    // EventBus → Amplitude. One emit per step the parent reaches.
    EventBus.emit('onboarding:step', { step: STEP_NAMES[step.value] })
    // Auto-focus the name input the moment step 2 lands so a parent who
    // tapped through quickly can start typing without an extra tap.
    if (step.value === 1) {
      await nextTick()
      nameInput.value?.focus()
    }
  } else {
    finish()
  }
}

function skip() {
  // Skip from any step — still persists whatever the parent did set so far,
  // then closes the flow. Don't roll back state on skip; toddler can play
  // with whatever defaults are present.
  finish()
}

async function finish() {
  // Persist whatever's in our local state. Empty name is fine — the
  // celebration audio falls back to just "Good job!" in that case.
  if (name.value.trim()) {
    await settings.setToddlerName(name.value.trim().toUpperCase())
  }
  await settings.setLanguage(language.value)
  await settings.setOnboardingComplete(true)
  open.value = false
  // `onboarding:complete` is consumed by BOTH Boot (to hand off to MainMenu)
  // and the amplitude service (to fire the funnel-end event). The payload
  // gives the funnel the user's final answers without a cross-event join.
  EventBus.emit('onboarding:complete', {
    name_set: !!settings.toddlerName(),
    language: settings.language()
  })
}

// ─── Name input — keep uppercase live, same UX as Settings ────────────
function onNameInput(e) {
  const upper = (e.target.value || '').toUpperCase()
  if (e.target.value !== upper) {
    const pos = e.target.selectionStart
    e.target.value = upper
    try {
      e.target.setSelectionRange(pos, pos)
    } catch {
      /* ignore */
    }
  }
  name.value = upper
}

function onNameKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.target.blur()
    next()
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-250"
    leave-active-class="transition-opacity duration-250"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[9998] overflow-hidden font-fredoka"
      role="dialog"
      aria-modal="true"
    >
      <!-- Sky-blue gradient base — picks up directly from the MainMenu
           background, so onboarding feels like the door INTO the game,
           not a separate hallway. -->
      <div class="absolute inset-0 bg-gradient-to-b from-[#5bb6ef] via-[#92cef1] to-[#c6ecff]" />

      <!-- Drifting clouds (same puffy 3-circle silhouette as the menu). -->
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

      <!-- Grass hills at the bottom — same green as the menu. -->
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 -left-12 h-48 w-[140%] rounded-[50%] bg-[#9bd34f]" />
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-32 -right-12 h-48 w-[130%] rounded-[50%] bg-[#7cc242]" />

      <!-- Content — fills viewport, content centred vertically per step -->
      <div
        class="relative flex h-full w-full flex-col px-6"
        :style="{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
        }"
      >
        <!-- Top row: step dots + skip -->
        <div class="flex items-center justify-between">
          <div class="flex gap-1.5" aria-label="Progress">
            <span
              v-for="i in totalSteps"
              :key="i"
              :class="[
                'h-2 rounded-full transition-all duration-200',
                i - 1 === step ? 'w-8 bg-white' : 'w-2 bg-white/40'
              ]"
            />
          </div>
          <button
            v-if="step < totalSteps - 1"
            type="button"
            class="text-sm font-semibold text-white/85 underline-offset-2 hover:underline"
            @click="skip"
          >
            Skip
          </button>
          <span v-else class="text-sm opacity-0">Skip</span>
        </div>

        <!-- Step body -->
        <div class="flex flex-1 flex-col items-center justify-center text-center">
          <!-- ── Step 0: Welcome ─────────────────────────────────────── -->
          <template v-if="step === 0">
            <!-- Sun mascot, big and friendly — same SVG as the Paywall but scaled up -->
            <div class="relative h-40 w-40 animate-drift-y">
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
                <circle cx="41" cy="48" r="3" fill="#c9821b" />
                <circle cx="59" cy="48" r="3" fill="#c9821b" />
                <path
                  d="M 41 56 Q 50 64 59 56"
                  stroke="#c9821b"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </div>

            <h1
              class="mt-6 text-4xl font-bold leading-tight text-white"
              style="text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15)"
            >
              Puzzle Pals
            </h1>
            <p class="mt-3 text-lg leading-snug text-white/90 max-w-sm">
              Made for little ones to learn to speak — one bright puzzle at a time
            </p>
          </template>

          <!-- ── Step 1: Toddler name ───────────────────────────────── -->
          <template v-else-if="step === 1">
            <div class="text-5xl">👋</div>
            <h2
              class="mt-4 text-3xl font-bold text-white"
              style="text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15)"
            >
              What's your little one's name?
            </h2>

            <!-- "Optional" pill — sets expectations up front so parents
                 don't feel a forced sign-up vibe. -->
            <span
              class="mt-3 inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/95"
            >
              Optional
            </span>

            <p class="mt-3 text-lg leading-snug text-white/90 max-w-sm">
              We use it to personalize the puzzle voice — your toddler will
              hear their own name in every celebration.
            </p>

            <input
              ref="nameInput"
              type="text"
              :value="name"
              maxlength="20"
              placeholder="TYPE A NAME…"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              class="mt-6 h-14 w-full max-w-xs rounded-full border-4 border-coral bg-cream px-5 text-center text-2xl font-bold uppercase text-warmInk outline-none shadow-chunkySm"
              style="text-transform: uppercase"
              @input="onNameInput"
              @keydown="onNameKeydown"
            />

            <!-- Live preview of what the celebration will sound like, so
                 parents can hear the value before they commit. -->
            <p class="mt-4 text-base text-white/80">
              Like:&nbsp;
              <span class="font-bold text-white">
                "Good job {{ name || '___' }}!"
              </span>
            </p>
          </template>

          <!-- ── Step 2: Language pick ──────────────────────────────── -->
          <template v-else-if="step === 2">
            <div class="text-5xl">🌍</div>
            <h2
              class="mt-4 text-3xl font-bold text-white"
              style="text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15)"
            >
              Pick a language
            </h2>
            <p class="mt-2 text-lg leading-snug text-white/90 max-w-sm">
              We'll spell every word out loud in this language
            </p>

            <div class="mt-8 flex w-full max-w-xs flex-col gap-3">
              <button
                type="button"
                :class="[
                  'h-16 w-full rounded-3xl border-2 text-lg font-bold transition-all',
                  language === 'en'
                    ? 'border-sunshineDark bg-sunshine text-royal scale-[1.02] shadow-chunkySm'
                    : 'border-white/40 bg-white/20 text-white'
                ]"
                @click="language = 'en'"
              >
                🇬🇧&nbsp;&nbsp;English
              </button>
              <button
                type="button"
                :class="[
                  'h-16 w-full rounded-3xl border-2 text-lg font-bold transition-all',
                  language === 'es'
                    ? 'border-sunshineDark bg-sunshine text-royal scale-[1.02] shadow-chunkySm'
                    : 'border-white/40 bg-white/20 text-white'
                ]"
                @click="language = 'es'"
              >
                🇪🇸&nbsp;&nbsp;Español
              </button>
            </div>
          </template>
        </div>

        <!-- CTA — fixed at the bottom across all steps -->
        <button
          type="button"
          class="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-coral to-coralDark text-lg font-bold text-white shadow-chunkySm transition-transform active:scale-[0.98]"
          style="text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3)"
          @click="next"
        >
          <span>{{ step === totalSteps - 1 ? "Let's play!" : 'Continue' }}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </Transition>
</template>
