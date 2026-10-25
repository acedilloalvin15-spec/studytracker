'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { useCurrentUser } from '@/components/app/user-provider'
import { clearOfflineData, getOfflineOwner, readAllOffline, setOfflineOwner } from '@/lib/offline'

/** Puts the saved copy of the student's data back on screen right away, so the app also works offline. */
export function OfflineSync() {
  const { userId } = useCurrentUser()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const owner = getOfflineOwner()
      if (owner && owner !== userId) await clearOfflineData()
      if (cancelled) return
      setOfflineOwner(userId)
      for (const [key, data] of readAllOffline()) {
        if (data !== null) mutate(key, data, { revalidate: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return null
}
