import type { Metadata } from 'next'
import { RetryButton } from '@/components/pwa/retry-button'

export const metadata: Metadata = { title: 'Offline' }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-balance">You&apos;re offline</h1>
      <p className="text-muted-foreground text-pretty">
        This page hasn&apos;t been saved on your phone yet. Connect to the internet and open it once, and it will work
        offline next time.
      </p>
      <RetryButton />
    </main>
  )
}
