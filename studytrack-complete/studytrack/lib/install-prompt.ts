'use client'

import { useSyncExternalStore } from 'react'

// Lets the app show its own "Install app" button on Android (Chrome) instead of only the browser menu.
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Starts listening for the browser's install offer. Returns a function that stops listening. */
export function listenForInstallPrompt() {
  const onPrompt = (e: Event) => {
    e.preventDefault()
    deferred = e as InstallEvent
    emit()
  }
  const onInstalled = () => {
    deferred = null
    emit()
  }
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** True while the browser is offering to install StudyTrack. */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferred !== null, () => false)
}

export async function promptInstall() {
  if (!deferred) return
  const event = deferred
  deferred = null
  emit()
  await event.prompt()
}
