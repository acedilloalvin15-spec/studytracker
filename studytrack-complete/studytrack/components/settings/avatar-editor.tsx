'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { initials, useCurrentUser } from '@/components/app/user-provider'
import { squareAvatar } from '@/lib/image'
import { createClient } from '@/lib/supabase/client'

export function AvatarEditor() {
  const { userId, email, profile, mutateProfile } = useCurrentUser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const path = `${userId}/avatar.jpg`

  async function save(url: string | null) {
    const { error } = await createClient().from('profiles').upsert({ id: userId, avatar_url: url })
    if (error) throw error
    await mutateProfile({ ...profile, avatar_url: url }, { revalidate: false })
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    if (!navigator.onLine) {
      toast.error('Changing your picture needs internet.')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a picture (JPG, PNG, or WebP).')
      return
    }
    setBusy(true)
    try {
      const small = await squareAvatar(file)
      const supabase = createClient()
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, small, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await save(`${data.publicUrl}?v=${Date.now()}`)
      toast.success('Profile picture updated')
    } catch {
      toast.error('Could not change your picture. Did you run supabase/avatars.sql in Supabase?')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    if (!navigator.onLine) {
      toast.error('Removing your picture needs internet.')
      return
    }
    setBusy(true)
    try {
      await createClient().storage.from('avatars').remove([path])
      await save(null)
      toast.success('Profile picture removed')
    } catch {
      toast.error('Could not remove your picture.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 flex items-center gap-4">
      <Avatar className="size-16">
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="Your profile picture" />}
        <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
          {initials(profile.full_name, email[0]?.toUpperCase())}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{profile.full_name ?? 'Student'}</p>
        <p className="truncate text-sm text-muted-foreground">{email}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose a profile picture"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
            {profile.avatar_url ? 'Change picture' : 'Add picture'}
          </Button>
          {profile.avatar_url && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
