'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/form-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { PageHeader } from '@/components/app/shared'
import { SelectField } from '@/components/app/select-field'
import { initials, useCurrentUser } from '@/components/app/user-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth'
import { clearOfflineData } from '@/lib/offline'
import { passwordSchema, profileSchema, type ProfileValues } from '@/lib/validations'
import type { ReminderSettings } from '@/lib/types'
import type { z } from 'zod'

const REMINDERS: { key: keyof ReminderSettings; label: string; hint: string }[] = [
  { key: 'three_days', label: '3 days before', hint: 'Show deadlines in the bell up to 3 days ahead.' },
  { key: 'one_day', label: '1 day before', hint: 'Show deadlines due within 24 hours.' },
  { key: 'due_day', label: 'On the due day', hint: 'Always show tasks due today.' },
  { key: 'email', label: 'Email reminders', hint: 'Saves your choice for email reminders.' },
]

export function SettingsView() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, reminders, and account." />
      <div className="flex max-w-2xl flex-col gap-6">
        <ProfileCard />
        <ReminderCard />
        <AppearanceCard />
        <PasswordCard />
        <DangerCard />
      </div>
    </>
  )
}

function ProfileCard() {
  const { userId, email, profile, mutateProfile } = useCurrentUser()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile.full_name ?? '', school: profile.school ?? '', year_level: profile.year_level ?? '' },
  })

  async function onSubmit(values: ProfileValues) {
    const payload = {
      id: userId,
      full_name: values.full_name,
      school: values.school?.trim() || null,
      year_level: values.year_level?.trim() || null,
    }
    const { error } = await createClient().from('profiles').upsert(payload)
    if (error) {
      toast.error('Could not save your profile.')
      return
    }
    await mutateProfile({ ...profile, ...payload }, { revalidate: false })
    reset(values)
    toast.success('Profile saved')
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>This is how StudyTrack greets you.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-center gap-3">
          <Avatar className="size-12">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
            <AvatarFallback className="bg-primary/15 font-semibold text-primary">{initials(profile.full_name, email[0]?.toUpperCase())}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{profile.full_name ?? 'Student'}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="full_name" label="Full name" error={errors.full_name?.message}>
            <Input id="full_name" autoComplete="name" className="h-10" aria-invalid={!!errors.full_name} {...register('full_name')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="school" label="School (optional)">
              <Input id="school" placeholder="e.g. Davao City National HS" className="h-10" {...register('school')} />
            </FormField>
            <FormField id="year_level" label="Year level (optional)">
              <Input id="year_level" placeholder="e.g. Grade 11 or 2nd year" className="h-10" {...register('year_level')} />
            </FormField>
          </div>
          <Button type="submit" className="h-10 self-start" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ReminderCard() {
  const { userId, profile, mutateProfile } = useCurrentUser()
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(key: keyof ReminderSettings, value: boolean) {
    const next = { ...profile.reminder_settings, [key]: value }
    setSaving(key)
    await mutateProfile({ ...profile, reminder_settings: next }, { revalidate: false })
    const { error } = await createClient().from('profiles').upsert({ id: userId, reminder_settings: next })
    setSaving(null)
    if (error) {
      await mutateProfile({ ...profile }, { revalidate: false })
      toast.error('Could not save that change.')
      return
    }
    toast.success('Reminder preference saved')
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <CardDescription>Choose when deadlines appear in your notification bell.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {REMINDERS.map(({ key, label, hint }) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p id={`rem-${key}`} className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Switch
                aria-labelledby={`rem-${key}`}
                checked={!!profile.reminder_settings[key]}
                disabled={saving === key}
                onCheckedChange={(v) => toggle(key, v)}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Pick light, dark, or follow your device.</CardDescription>
      </CardHeader>
      <CardContent>
        <SelectField
          ariaLabel="Theme"
          className="sm:w-56"
          value={mounted ? theme ?? 'system' : undefined}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'Match my device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) })

  async function onSubmit({ password }: z.infer<typeof passwordSchema>) {
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      toast.error(friendlyAuthError(error))
      return
    }
    reset()
    toast.success('Password changed')
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use at least 8 characters. If you signed in with Google, you can set a password here too.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="new_password" label="New password" error={errors.password?.message}>
            <Input id="new_password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <FormField id="confirm_new_password" label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input id="confirm_new_password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="h-10 self-start" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DangerCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function deleteAccount() {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      toast.error(body?.error ?? 'Could not delete your account.')
      throw new Error('delete failed')
    }
    await createClient().auth.signOut()
    await clearOfflineData()
    toast.success('Your account was deleted.')
    router.replace('/')
    router.refresh()
  }

  return (
    <Card className="rounded-2xl border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>Permanently removes your account, subjects, tasks, schedule, and review plans. This cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="Everything you saved in StudyTrack will be permanently deleted."
        confirmLabel="Yes, delete everything"
        onConfirm={() => deleteAccount().catch(() => undefined)}
      />
    </Card>
  )
}
