'use client'

import { useEffect } from 'react'
import { listenForInstallPrompt } from '@/lib/install-prompt'

export function RegisterSW() {
  useEffect(() => {
    const stopListening = listenForInstallPrompt()
    let stopWaiting: (() => void) | undefined

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => undefined)
      }
      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register)
        stopWaiting = () => window.removeEventListener('load', register)
      }
    }

    return () => {
      stopListening()
      stopWaiting?.()
    }
  }, [])
  return null
}
