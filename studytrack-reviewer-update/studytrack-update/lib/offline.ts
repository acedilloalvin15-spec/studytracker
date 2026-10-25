// Helpers that keep a copy of the student's data on the device so the app can be read offline.
const PREFIX = 'studytrack-offline:'
const OWNER_KEY = `${PREFIX}owner`

export function saveOffline(key: string, data: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the app still works online.
  }
}

export function readAllOffline(): [string, unknown][] {
  const out: [string, unknown][] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX) || k === OWNER_KEY) continue
      out.push([k.slice(PREFIX.length), JSON.parse(localStorage.getItem(k) ?? 'null')])
    }
  } catch {
    // Ignore unreadable entries.
  }
  return out
}

export function getOfflineOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

export function setOfflineOwner(userId: string) {
  try {
    localStorage.setItem(OWNER_KEY, userId)
  } catch {
    // Ignore.
  }
}

/** Removes the saved copy of the data and saved pages. Called on log out and when another account logs in. */
export async function clearOfflineData() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // Ignore.
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('studytrack-pages-')).map((n) => caches.delete(n)))
    }
  } catch {
    // Ignore.
  }
}
