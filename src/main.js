import App from './App.vue'
import { createApp } from 'vue'
import { initNative } from './services/native'

createApp(App).mount('#app')

// Initialise Capacitor native features (splash, IAP, notifications, …).
// Beyond launch-counting this is a no-op in a plain browser.
initNative()

