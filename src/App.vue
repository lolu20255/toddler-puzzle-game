<script setup>
import { ref } from 'vue'
import PhaserGame from './game/PhaserGame.vue'
import Paywall from './components/Paywall.vue'
import Onboarding from './components/Onboarding.vue'
import RateUs from './components/RateUs.vue'

const phaserRef = ref()

// Track the current active scene name. Mostly useful if any chrome ever
// wants to render conditionally based on what's on screen below.
const currentSceneKey = ref(null)
const currentScene = (scene) => {
  currentSceneKey.value = scene?.scene?.key || null
}
</script>

<template>
  <PhaserGame ref="phaserRef" @current-active-scene="currentScene" />

  <!--
    Vue overlays sit ABOVE the Phaser canvas with a high z-index. They
    register their own EventBus listeners (e.g. 'paywall:open',
    'onboarding:open', 'rate-us:check') so any Phaser scene can trigger
    them with one emit() call.
  -->
  <Onboarding />
  <Paywall />
  <RateUs />
</template>
