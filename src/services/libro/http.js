/**
 * HTTP client for the libro-ai backend.
 *
 * Base URL is read from `VITE_LIBRO_API_BASE_URL`, which Vite resolves from:
 *   - `.env`            (gitignored, your local overrides — typically localhost)
 *   - `.env.production` (committed, production URL — used by `npm run build`)
 *
 * The hardcoded prod URL is kept only as a safety net if neither env file
 * resolves the variable, so the app never silently calls `undefined/...`.
 *
 * `Authorization: Bearer <token>` is set on `HTTP.defaults` by `auth.js` once
 * a token is obtained, so individual call sites don't have to thread the
 * token around.
 */
import axios from 'axios'

const baseURL =
  import.meta.env.VITE_LIBRO_API_BASE_URL ||
  'https://libro-ai.blackboxcode.io'

if (import.meta.env.DEV) {
  // Visible in the dev console so you always know which backend you're hitting.
  console.log('[Libro] HTTP base URL:', baseURL)
}

export const HTTP = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})
