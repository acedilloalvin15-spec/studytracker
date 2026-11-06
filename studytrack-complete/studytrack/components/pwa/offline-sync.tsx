'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { useCurrentUser } from '@/components/app/user-provider'
import { clearOfflineData, getOfflineOwner, readAllOffline, setOfflineOwner } from '@/lib/offline'
import { QUEUEABLE_TABLES, flushQueue } from '@/lib/offline-queue'

const PAGES = ['/dashboard', '/tasks', '/subjects', '/schedule', '/review', '/reviewers', '/calendar', '/settings']
const WARM_KEY = 'studytrack-warm-at'
const SIX_HOURS = 6 * 60 * 60 * 1000

/** Keeps the saved copy of the data in step, sends offline changes, and saves pages for offline use. */
export function OfflineSync() {
  const { userId } = useCurrentUser()

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    ;(async () => {
      const owner = getOfflineOwner()
      if (owner && owner !== userId) await clearOfflineData()
      if (cancelled) return
      setOfflineOwner(userId)

      // Show saved reviewers right away. Deadlines, subjects, classes, and exams load themselves.
      for (const [key, data] of readAllOffline()) {
        if (data !== null && !QUEUEABLE_TABLES.includes(key)) mutate(key, data, { revalidate: false })
      }

      void flushQueue()

      // Save the main pages (and reviewers you made) so they open offline even if never visited.
      timer = setTimeout(async () => {
        if (!navigator.onLine || !('serviceWorker' in navigator)) return
        const last = Number(localStorage.getItem(WARM_KEY) ?? 0)
        if (Date.now() - last < SIX_HOURS) return
        const urls = PAGES
        const reg = await navigator.serviceWorker.getRegistration()
        const worker = reg?.active
        if (worker) {
          worker.postMessage({ type: 'CACHE_PAGES', urls })
          localStorage.setItem(WARM_KEY, String(Date.now()))
        }
      }, 6000)
    })()

    const onOnline = () => void flushQueue()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flushQueue()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  return null
}
