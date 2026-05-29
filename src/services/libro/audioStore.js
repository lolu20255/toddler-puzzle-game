/**
 * Persistent blob store for pronunciation audio.
 *
 * IndexedDB rather than `@capacitor/filesystem` because:
 *   1. No new native dependency — IDB is built into every WebView (iOS WKWebView,
 *      Android WebView, every desktop browser).
 *   2. Same code path on native + browser — no platform branching.
 *   3. Capacitor doesn't clear IDB across launches; the only way an MP3 leaves
 *      this store is the user clearing app data or uninstalling.
 *
 * All errors are swallowed and the call returns `null` (read) or resolves
 * (write) — pronunciation caching is best-effort and must never break the
 * celebration modal.
 */

const DB_NAME = 'libro-pronunciations'
const STORE = 'audio'
const DB_VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB unavailable'))
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((e) => {
    // Mark the promise as null so the next call retries — but cache the
    // rejection if it's a hard failure (we'll just keep returning null).
    dbPromise = null
    throw e
  })
  return dbPromise
}

/** Read a cached blob. Returns null on miss or any IDB error. */
export async function getBlob(key) {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** Persist a blob. Best-effort — never throws. */
export async function putBlob(key, blob) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* persistence is a nice-to-have; never break a celebration over it */
  }
}
