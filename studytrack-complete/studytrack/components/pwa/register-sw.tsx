'use client'

import { useEffect } from 'react'
import { startInstallCapture } from '@/lib/install'

export function RegisterSW() {
  useEffect(() => {
    startInstallCapture()
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])
  return null
}
