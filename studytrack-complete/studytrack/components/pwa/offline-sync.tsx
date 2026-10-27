'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { toast } from 'sonner'
import { useCurrentUser } from '@/components/app/user-provider'
import { clearOfflineData, getOfflineOwner, readAllOffline, setOfflineOwner } from '@/lib/offline'
import { flushQueue, pendingCount } from '@/lib/offline-queue'

/**
 * Puts the saved copy of the student's data back on screen right away, so the app also works offline,
 * and sends changes that were made offline once the internet is back.
 */
export function OfflineSync() {
  const { userId } = useCurrentUser()

  useEffect(() => {
    let cancelled = false

    async function syncNow() {
      const { done, dropped } = await flushQueue()
      if (cancelled) return
      if (dropped > 0) toast.error('Some changes made offline could not be saved.')
      else if (done > 0) toast.success('Your offline changes were saved.')
    }

    ;(async () => {
      const owner = getOfflineOwner()
      if (owner && owner !== userId) await clearOfflineData()
      if (cancelled) return
      setOfflineOwner(userId)
      for (const [key, data] of readAllOffline()) {
        if (data !== null) mutate(key, data, { revalidate: false })
      }
      await syncNow()
    })()

    const onOnline = () => {
      void syncNow()
    }
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => {
      if (pendingCount() > 0) void syncNow()
    }, 20_000)

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [userId])

  return null
}
