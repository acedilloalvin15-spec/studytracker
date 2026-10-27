'use client'

import { useSyncExternalStore } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { usePendingCount } from '@/lib/offline-queue'

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
  const pending = usePendingCount()
  if (online && pending === 0) return null

  const waiting = pending > 0 ? ` ${pending} change${pending === 1 ? ' is' : 's are'} waiting to be saved online.` : ''

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-lg md:bottom-4"
    >
      {online ? (
        <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <WifiOff className="mt-0.5 size-4 shrink-0 text-urgent" aria-hidden="true" />
      )}
      <p className="text-pretty">
        {online ? (
          <span className="font-medium">Saving your offline changes…{waiting}</span>
        ) : (
          <>
            <span className="font-medium">You&apos;re offline.</span> You can still add and edit tasks, subjects, classes
            and exams. They&apos;ll be saved online when the internet is back.{waiting} Deleting and the Reviewer maker need
            internet.
          </>
        )}
      </p>
    </div>
  )
}
