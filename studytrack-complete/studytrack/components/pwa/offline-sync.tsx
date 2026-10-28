'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { toast } from 'sonner'
import { useCurrentUser } from '@/components/app/user-provider'
import { clearOfflineData, getOfflineOwner, readAllOffline, setOfflineOwner } from '@/lib/offline'
import { flushQueue, pendingCount } from '@/lib/offline-queue'

// Every page of the app. They are loaded once in the background so they also open without internet.
const PAGES = ['/dashboard', '/tasks', '/subjects', '/schedule', '/review', '/calendar', '/reviewers', '/settings']
const PRECACHE_KEY = 'studytrack-offline:__precached-at'
const PRECACHE_EVERY_MS = 24 * 60 * 60 * 1000

function loadInHiddenFrame(url: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.src = url
    frame.tabIndex = -1
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none'
    const finish = () => {
      window.clearTimeout(timer)
      frame.remove()
      resolve()
    }
    const timer = window.setTimeout(finish, 15_000)
    // After the page has loaded, wait a moment so its scripts and styles are saved too.
    frame.addEventListener('load', () => window.setTimeout(finish, 1500))
    document.body.appendChild(frame)
  })
}

async function savePagesForOffline() {
  try {
    if (!navigator.onLine || !navigator.serviceWorker?.controller) return
    const last = Number(localStorage.getItem(PRECACHE_KEY) ?? 0)
    if (Date.now() - last < PRECACHE_EVERY_MS) return
    for (const url of PAGES) {
      if (!navigator.onLine) return
      await loadInHiddenFrame(url)
    }
    localStorage.setItem(PRECACHE_KEY, String(Date.now()))
  } catch {
    // Best effort only.
  }
}

/**
 * Puts the saved copy of the student's data back on screen right away, so the app also works offline,
 * sends changes that were made offline once the internet is back, and saves every page for offline use.
 */
export function OfflineSync() {
  const { userId } = useCurrentUser()

  useEffect(() => {
    // The hidden pages used for saving also run this component. Only the real window does the work.
    if (window.self !== window.top) return

    let cancelled = false

    async function syncNow() {
      const { done, dropped } = await flushQueue()
      if (cancelled) return
      if (dropped > 0) toast.error('Some changes made offline could not be saved.')
      else if (done > 0) toast.success('Your offline changes were saved.')
    }

    let precacheTimer: number | undefined

    ;(async () => {
      const owner = getOfflineOwner()
      if (owner && owner !== userId) await clearOfflineData()
      if (cancelled) return
      setOfflineOwner(userId)
      for (const [key, data] of readAllOffline()) {
        if (data !== null) mutate(key, data, { revalidate: false })
      }
      await syncNow()
      if (!cancelled) precacheTimer = window.setTimeout(() => void savePagesForOffline(), 5000)
    })()

    const onOnline = () => {
      void syncNow()
      window.clearTimeout(precacheTimer)
      precacheTimer = window.setTimeout(() => void savePagesForOffline(), 5000)
    }
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => {
      if (pendingCount() > 0) void syncNow()
    }, 20_000)

    return () => {
      cancelled = true
      window.clearTimeout(precacheTimer)
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [userId])

  return null
}
