'use client'

import { useState, useSyncExternalStore } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDeferredInstall, isInstalledNow, promptInstall, subscribeInstall } from '@/lib/install'

export function InstallCard() {
  const canPrompt = useSyncExternalStore(subscribeInstall, () => getDeferredInstall() !== null, () => false)
  const installed = useSyncExternalStore(subscribeInstall, () => isInstalledNow(), () => false)
  const [busy, setBusy] = useState(false)

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" aria-hidden="true" /> Install on your phone
        </CardTitle>
        <CardDescription>
          Add StudyTrack to your home screen. It opens full screen like an app and keeps working without internet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {installed ? (
          <p className="text-sm font-medium text-later">StudyTrack is installed on this device.</p>
        ) : canPrompt ? (
          <Button
            className="self-start"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await promptInstall()
              setBusy(false)
            }}
          >
            <Download aria-hidden="true" /> Install app
          </Button>
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>Android (Chrome): tap the three dots at the top right, then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
            <li>iPhone (Safari): tap the Share button, then <strong>Add to Home Screen</strong>.</li>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
