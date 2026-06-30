<script setup>
/**
 * Lifetime-unlock paywall. Vue + Tailwind so we get native text rendering,
 * accessibility (VoiceOver, Dynamic Type), and easy CSS animations — all
 * the things a canvas-rendered paywall can't give us.
 *
 * Triggered from any Phaser scene via:
 *   EventBus.emit('paywall:open')
 *
 * On successful purchase or restore, emits an `entitlement:updated` event
 * so MainMenu can rebuild its card grid (locks vanish, free-first sort
 * stops re-ordering).
 *
 * Parental gate (math question) sits in front of the purchase call, per
 * Apple kids-category requirements.
 */
import { ref, computed, onMounted, onUnmounted, markRaw, toRaw } from 'vue'
import { EventBus } from '../game/EventBus'
import { purchasesService } from '../services/purchases'
import { isAndroid } from '../services/platform'

const PRIVACY_URL = 'https://blackboxcode.io/Privacy.html'
const TERMS_URL_IOS =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
const TERMS_URL_ANDROID = 'https://play.google.com/about/play-terms/'
const PREVIEW_PRICE = '$4.99'

const open = ref(false)
const lifetimePackage = ref(null)
const priceString = ref(PREVIEW_PRICE)
const processing = ref(false)
const restoring = ref(false)
const toast = ref('')
let toastTimer = null

// Parental gate state. Kids-category (Guideline 5.1.4) requires any purchase
// to sit behind a task a young child can't complete. We use a TYPED answer to
// a two-digit sum (e.g. "2 + 15") rather than multiple choice, so it can't be
// passed by guessing.
const gateOpen = ref(false)
const gateA = ref(0)
const gateB = ref(0)
const gateAnswer = ref('')
const gateCorrect = computed(() => gateA.value + gateB.value)
const shaking = ref(false)

const termsUrl = computed(() =>
  isAndroid() ? TERMS_URL_ANDROID : TERMS_URL_IOS
)

// Benefits emphasise the LEARNING-TO-SPEAK angle, not a feature checklist.
// Parents buy because the app teaches their toddler new words and sounds —
// the pack count is a side-effect, not the headline.
const benefits = [
  { icon: '🗣️', label: 'Learn to speak & say new words' },
  { icon: '🧠', label: 'Build vocabulary every play' },
  { icon: '🌍', label: 'English & Spanish voices' },
  { icon: '♾️', label: 'Unlimited puzzles' }
]

// ─── EventBus wiring ───────────────────────────────────────────────────
const onOpen = () => {
  console.log('[Paywall.vue] received paywall:open')
  open.value = true
  // EventBus → Amplitude. Fires every time the overlay actually opens — not
  // just on the first paywall:open (toddler may have tried + cancelled,
  // tapped another locked card, etc.).
  EventBus.emit('paywall:viewed')
  loadOffering()
}
const onClose = () => {
  open.value = false
  gateOpen.value = false
  processing.value = false
}

onMounted(() => {
  console.log('[Paywall.vue] mounted, registering EventBus listener')
  EventBus.on('paywall:open', onOpen)
  EventBus.on('paywall:close', onClose)
})
onUnmounted(() => {
  EventBus.off('paywall:open', onOpen)
  EventBus.off('paywall:close', onClose)
  if (toastTimer) clearTimeout(toastTimer)
})

// ─── Data load ─────────────────────────────────────────────────────────
async function loadOffering() {
  if (lifetimePackage.value) return // already loaded
  const offering = await purchasesService.getOfferings()
  if (!offering) return // dev / no API key → keep PREVIEW_PRICE
  const pkgs = offering.availablePackages || []
  const lifetime =
    pkgs.find((p) => /lifetime/i.test(p.packageType || p.identifier || '')) ||
    pkgs.find((p) => /custom/i.test(p.packageType || '')) ||
    pkgs[0]
  if (!lifetime) return
  // markRaw: keep the RevenueCat package a PLAIN object. If Vue wraps it in a
  // reactive Proxy, passing it back through the Capacitor bridge to
  // purchasePackage() loses the package and the native SDK rejects the call
  // with "Must provide aPackage parameter".
  lifetimePackage.value = markRaw(lifetime)
  priceString.value = lifetime.product?.priceString || PREVIEW_PRICE
}

// ─── Parental gate ─────────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// The action to run once the parental gate is solved. Set by openParentalGate
// so the SAME gate guards the purchase AND the outbound Privacy/Terms links —
// Apple Kids Category (Guideline 1.3 / 5.1.4) requires a parental gate in front
// of both purchases and any link that leaves the app.
let gateAction = null

/** Open a URL in the system browser (matches the window.open pattern in Settings). */
function openExternal(url) {
  window.open(url, '_blank')
}

function openParentalGate(action) {
  if (processing.value) return
  gateAction = action
  // Two-digit sum a parent solves instantly but a toddler can't (e.g. 2 + 15).
  gateA.value = rand(2, 9)
  gateB.value = rand(11, 19)
  gateAnswer.value = ''
  shaking.value = false
  gateOpen.value = true
}

function submitAnswer() {
  if (parseInt(gateAnswer.value, 10) === gateCorrect.value) {
    gateOpen.value = false
    const action = gateAction
    gateAction = null
    if (action) action()
  } else {
    shaking.value = true
    gateAnswer.value = ''
    setTimeout(() => {
      shaking.value = false
    }, 450)
  }
}

// ─── Purchase / restore ────────────────────────────────────────────────
async function purchase() {
  if (!lifetimePackage.value) {
    showToast("That purchase isn't available right now")
    return
  }
  processing.value = true
  // EventBus → Amplitude. `purchase_started` fires the moment the StoreKit /
  // Play Billing modal is invoked — the four branches below resolve to one
  // of `purchase_completed`, `purchase_cancelled`, or `purchase_failed`.
  EventBus.emit('paywall:purchase_started')
  // toRaw: unwrap any Vue reactive proxy so the Capacitor bridge receives the
  // plain RevenueCat package object (see markRaw note in loadOffering).
  const result = await purchasesService.purchasePackage(toRaw(lifetimePackage.value))
  processing.value = false
  if (result.success) {
    EventBus.emit('paywall:purchase_completed')
    showToast('Welcome to Premium! 🎉')
    EventBus.emit('entitlement:updated')
    setTimeout(onClose, 1200)
  } else if (result.cancelled) {
    EventBus.emit('paywall:purchase_cancelled')
  } else {
    EventBus.emit('paywall:purchase_failed')
    showToast("Couldn't complete the purchase")
  }
}

async function restore() {
  if (restoring.value) return
  restoring.value = true
  EventBus.emit('paywall:restore_started')
  const result = await purchasesService.restorePurchases()
  restoring.value = false
  if (result.success) {
    EventBus.emit('paywall:restore_completed')
    showToast('Welcome back to Premium!')
    EventBus.emit('entitlement:updated')
    setTimeout(onClose, 1200)
  } else if (result.error) {
    EventBus.emit('paywall:restore_failed')
    showToast('No previous purchase found')
  } else {
    EventBus.emit('paywall:restore_no_purchases')
    showToast('No previous purchase found')
  }
}

// ─── Toast ─────────────────────────────────────────────────────────────
function showToast(message) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
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
      class="fixed inset-0 z-[9999] overflow-hidden font-fredoka"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <!-- Background gradient — warm cream → peach so it reads as marketing
           chrome instead of game world, but the decorative layer on top
           pulls back in the game's signature sky elements (sun, clouds,
           twinkles) so the transition from gameplay feels continuous. -->
      <div class="absolute inset-0 bg-gradient-to-b from-cream via-peach-200 to-peach-300" />

      <!-- Soft ambient colour blobs (kept subtle so they don't compete with
           the sky layer or the text). -->
      <div
        aria-hidden="true"
        class="absolute -top-12 right-2 h-64 w-64 rounded-full bg-sunshine/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        class="absolute top-1/3 -left-12 h-56 w-56 rounded-full bg-pink-400/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        class="absolute -bottom-12 -right-12 h-72 w-72 rounded-full bg-purple-400/10 blur-3xl"
      />

      <!-- ── Sky decoration: sun mascot + clouds + twinkles ────────────── -->
      <!-- Sun mascot in the top-left, peeking in. Same smiley face as the
           MainMenu sun so the paywall reads as part of the same world. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -left-6 top-4 h-28 w-28 animate-drift-y"
      >
        <svg viewBox="0 0 100 100" class="h-full w-full overflow-visible">
          <!-- Rays — rotate slowly. Drawn as 8 triangles around the centre. -->
          <g class="origin-center animate-spin-slow" style="transform-origin: 50px 50px;">
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
          <!-- Disc + soft inner highlight -->
          <circle cx="50" cy="50" r="22" fill="#ffd23f" />
          <circle cx="44" cy="44" r="9" fill="#ffe78a" opacity="0.7" />
          <!-- Smiley face — matches the procedural sun on the MainMenu -->
          <circle cx="42" cy="48" r="2.6" fill="#c9821b" />
          <circle cx="58" cy="48" r="2.6" fill="#c9821b" />
          <path
            d="M 42 55 Q 50 62 58 55"
            stroke="#c9821b"
            stroke-width="2.8"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <!-- Fluffy white clouds at varied positions — three overlapping
           circles each gives that classic cartoon-puff silhouette. -->
      <div aria-hidden="true" class="pointer-events-none absolute top-12 right-16 h-10 w-20">
        <div class="absolute left-0 top-1 h-7 w-9 rounded-full bg-white/95" />
        <div class="absolute left-5 top-0 h-9 w-12 rounded-full bg-white/95" />
        <div class="absolute left-12 top-2 h-7 w-9 rounded-full bg-white/95" />
      </div>
      <div aria-hidden="true" class="pointer-events-none absolute top-1/3 right-4 h-8 w-16">
        <div class="absolute left-0 top-1 h-5 w-7 rounded-full bg-white/90" />
        <div class="absolute left-4 top-0 h-7 w-9 rounded-full bg-white/90" />
        <div class="absolute left-9 top-1 h-5 w-7 rounded-full bg-white/90" />
      </div>
      <div aria-hidden="true" class="pointer-events-none absolute top-1/2 left-2 h-9 w-18">
        <div class="absolute left-0 top-1 h-6 w-8 rounded-full bg-white/85" />
        <div class="absolute left-4 top-0 h-8 w-11 rounded-full bg-white/85" />
        <div class="absolute left-11 top-2 h-6 w-7 rounded-full bg-white/85" />
      </div>

      <!-- Twinkling stars scattered in negative space. CSS keyframes — no
           JS animation cost. Staggered delays so they pulse out of sync. -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0">
        <span
          class="absolute right-32 top-20 text-base text-sunshine animate-twinkle"
          style="animation-delay: 0s"
        >✦</span>
        <span
          class="absolute right-10 top-44 text-xs text-pink-400 animate-twinkle"
          style="animation-delay: 0.7s"
        >✦</span>
        <span
          class="absolute left-32 top-10 text-sm text-purple-400 animate-twinkle"
          style="animation-delay: 1.2s"
        >✦</span>
        <span
          class="absolute left-12 top-1/3 text-base text-sunshine animate-twinkle"
          style="animation-delay: 0.4s"
        >✦</span>
        <span
          class="absolute right-24 top-2/3 text-sm text-pink-400 animate-twinkle"
          style="animation-delay: 1.8s"
        >✦</span>
        <span
          class="absolute left-1/4 top-1/2 text-xs text-purple-400 animate-twinkle"
          style="animation-delay: 1s"
        >✦</span>
      </div>

      <!-- Content stack — fills viewport, content pushed to anchors -->
      <div
        class="relative flex h-full w-full flex-col px-6"
        :style="{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
        }"
      >
        <!-- Top row: close button -->
        <div class="flex justify-end">
          <button
            type="button"
            aria-label="Close"
            class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-coral/60 bg-white/95 text-lg font-bold text-warm shadow-sm transition-transform active:scale-95"
            @click="onClose"
          >
            ✕
          </button>
        </div>

        <!-- Hero -->
        <div class="mt-2 flex flex-col items-center text-center">
          <!-- Crown badge — SVG instead of emoji for crisp rendering -->
          <div class="relative">
            <div
              aria-hidden="true"
              class="absolute inset-0 translate-y-1.5 rounded-full bg-black/20 blur-sm"
            />
            <div
              class="relative flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-yellow-700 bg-sunshine shadow-md"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-10 w-10 text-yellow-900"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M3 18l2-9 4 4 3-7 3 7 4-4 2 9H3zm0 2h18v2H3z"
                />
              </svg>
            </div>
          </div>

          <h1
            id="paywall-title"
            class="mt-5 text-4xl font-bold leading-tight text-royal"
            style="text-shadow: 0 1px 0 #fff"
          >
            Unlock All Puzzles!
          </h1>

          <p
            class="mt-10 text-base leading-snug text-warm"
            aria-describedby="paywall-title"
          >
            Help your toddler learn to speak —<br />
            every puzzle is a new word, in two languages
          </p>
        </div>

        <!-- Benefits 2×2 grid -->
        <ul class="mt-6 grid grid-cols-2 gap-3" role="list">
          <li
            v-for="b in benefits"
            :key="b.label"
            class="flex items-center gap-3 rounded-2xl border border-coral/30 bg-white/90 p-3 shadow-sm"
          >
            <span class="text-2xl leading-none" aria-hidden="true">{{ b.icon }}</span>
            <span class="text-sm font-bold leading-tight text-warmInk">{{ b.label }}</span>
          </li>
        </ul>

        <!-- Pricing card -->
        <div class="mt-auto pt-6">
          <div
            class="relative overflow-hidden rounded-3xl border-2 border-sunshineDark bg-gradient-to-b from-yellow-200 to-sunshine p-5 text-center shadow-chunkySm"
          >
            <!-- Glossy top highlight -->
            <div
              aria-hidden="true"
              class="absolute inset-x-6 top-2 h-1/3 rounded-2xl bg-white/40"
            />
            <p
              class="relative text-[11px] font-bold uppercase tracking-[0.2em] text-warm"
            >
              One-time purchase
            </p>
            <p
              class="relative mt-1 text-5xl font-bold leading-none text-royal"
              style="text-shadow: 0 1px 0 #fff"
              aria-label="Price"
            >
              {{ priceString }}
            </p>
            <p class="relative mt-2 text-sm text-warm">
              Pay once, play forever ✨
            </p>
          </div>

          <!-- CTA -->
          <button
            type="button"
            :disabled="processing"
            class="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-coral to-coralDark text-lg font-bold text-white shadow-chunkySm transition-transform active:scale-[0.98] disabled:opacity-60"
            style="text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3)"
            @click="openParentalGate(purchase)"
          >
            <span aria-hidden="true">🔓</span>
            <span>{{ processing ? 'Processing…' : 'Unlock Everything' }}</span>
          </button>

          <!-- Footer: restore + legal -->
          <div
            class="mt-3 flex items-center justify-center gap-2 text-xs text-warm/80"
          >
            <button
              type="button"
              :disabled="restoring"
              class="font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              @click="restore"
            >
              {{ restoring ? 'Restoring…' : 'Restore' }}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              class="font-semibold underline-offset-2 hover:underline"
              @click="openParentalGate(() => openExternal(PRIVACY_URL))"
            >
              Privacy
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              class="font-semibold underline-offset-2 hover:underline"
              @click="openParentalGate(() => openExternal(termsUrl))"
            >
              Terms
            </button>
          </div>
        </div>
      </div>

      <!-- Parental gate overlay -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="gateOpen"
          class="absolute inset-0 z-10 flex items-center justify-center bg-black/55 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-title"
          @click.self="gateOpen = false"
        >
          <div
            :class="[
              'w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-pop-in',
              shaking && 'animate-shake'
            ]"
          >
            <div class="flex items-start justify-between">
              <h2
                id="gate-title"
                class="flex items-center gap-2 text-lg font-bold text-royal"
              >
                <span aria-hidden="true">🔒</span> Ask a Grown-up
              </h2>
              <button
                type="button"
                aria-label="Close"
                class="text-warm hover:text-warmInk"
                @click="gateOpen = false"
              >
                ✕
              </button>
            </div>
            <p class="mt-1 text-sm text-warm">
              Type the answer to continue
            </p>
            <p
              class="mt-6 text-center text-4xl font-bold text-royal"
              aria-label="Math question"
            >
              {{ gateA }} + {{ gateB }} = ?
            </p>
            <input
              v-model="gateAnswer"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              placeholder="?"
              aria-label="Your answer"
              class="mt-6 h-14 w-full rounded-2xl border-2 border-coral/40 bg-cream text-center text-3xl font-bold text-royal focus:border-coral focus:outline-none"
              @keyup.enter="submitAnswer"
            />
            <button
              type="button"
              :disabled="gateAnswer === ''"
              class="mt-4 h-12 w-full rounded-full bg-gradient-to-b from-coral to-coralDark text-lg font-bold text-white shadow-chunkySm transition-transform active:scale-[0.98] disabled:opacity-50"
              @click="submitAnswer"
            >
              Continue
            </button>
          </div>
        </div>
      </Transition>

      <!-- Toast -->
      <Transition
        enter-active-class="transition-all duration-200"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="toast"
          class="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full bg-royal px-4 py-2 text-sm font-bold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          {{ toast }}
        </div>
      </Transition>
    </div>
  </Transition>
</template>
