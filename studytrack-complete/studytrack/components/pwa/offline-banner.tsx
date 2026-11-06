'use client'

import { useSyncExternalStore } from 'react'
import { CloudUpload, WifiOff } from 'lucide-react'
import { pendingCountSnapshot, subscribeQueue } from '@/lib/offline-queue'

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  const pending = useSyncExternalStore(subscribeQueue, pendingCountSnapshot, () => 0)

  if (online && pending === 0) return null

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-lg md:bottom-4"
    >
      {online ? (
        <CloudUpload className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <WifiOff className="mt-0.5 size-4 shrink-0 text-urgent" aria-hidden="true" />
      )}
      <p className="text-pretty">
        {online ? (
          <>Saving {pending} change{pending === 1 ? '' : 's'} you made offline…</>
        ) : (
          <>
            <span className="font-medium">You&apos;re offline.</span> You can still add and change deadlines, subjects,
            classes, and exams. They are saved on your phone and sent when you are back online.
            {pending > 0 && <> Waiting to send: {pending}.</>}
          </>
        )}
      </p>
    </div>
  )
}
