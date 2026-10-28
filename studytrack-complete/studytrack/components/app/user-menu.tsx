'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookMarked, Download, FileText, LogOut, Settings, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials, useCurrentUser } from '@/components/app/user-provider'
import { createClient } from '@/lib/supabase/client'
import { clearOfflineData } from '@/lib/offline'

export function UserMenu() {
  const router = useRouter()
  const { profile, email } = useCurrentUser()
  const [showDownload, setShowDownload] = useState(false)

  // Offer the Android app file on Android phones, but not inside the installed app itself.
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setShowDownload(/android/i.test(navigator.userAgent) && !standalone)
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    await clearOfflineData()
    toast.success('Signed out. See you soon!')
    router.replace('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu" />}>
        <Avatar className="size-8">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {initials(profile.full_name, email[0]?.toUpperCase())}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="truncate font-medium text-foreground">{profile.full_name ?? 'Student'}</p>
            <p className="truncate text-xs font-normal">{email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <UserRound aria-hidden="true" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/reviewers')}>
          <FileText aria-hidden="true" /> Reviewer maker
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/subjects')}>
          <BookMarked aria-hidden="true" /> Subjects
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings aria-hidden="true" /> Settings
        </DropdownMenuItem>
        {showDownload && (
          <DropdownMenuItem
            onClick={() => {
              window.location.href = '/downloads/studytrack.apk'
            }}
          >
            <Download aria-hidden="true" /> Download Android app
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
