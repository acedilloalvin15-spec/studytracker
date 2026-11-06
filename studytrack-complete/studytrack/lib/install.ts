// Remembers Chrome's "install this app" offer, because Chrome sends it only once, early on.
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function startInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

export function subscribeInstall(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const getDeferredInstall = () => deferred

export function isInstalledNow() {
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export async function promptInstall() {
  if (!deferred) return null
  const ev = deferred
  await ev.prompt()
  const choice = await ev.userChoice
  deferred = null
  emit()
  return choice.outcome
}
