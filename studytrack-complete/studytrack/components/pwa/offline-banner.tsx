'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-lg md:bottom-4"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0 text-urgent" aria-hidden="true" />
      <p className="text-pretty">
        <span className="font-medium">You&apos;re offline.</span> You can read your saved deadlines, schedule, and reviewers.
        Adding or changing things needs internet.
      </p>
    </div>
  )
}
