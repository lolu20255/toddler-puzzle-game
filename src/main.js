import App from './App.vue'
import { createApp } from 'vue'
import { initNative } from './services/native'
import '@fontsource/fredoka/latin-400.css'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/bruno-ace-sc/latin-400.css'
import './style.css'

createApp(App).mount('#app')

// Initialise Capacitor native features (splash, IAP, notifications, …).
// Beyond launch-counting this is a no-op in a plain browser.
initNative()

