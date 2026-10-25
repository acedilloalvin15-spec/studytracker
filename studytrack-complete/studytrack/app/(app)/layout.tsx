import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app/app-shell'
import { UserProvider } from '@/components/app/user-provider'
import { OfflineSync } from '@/components/pwa/offline-sync'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

const DEFAULT_REMINDERS = { three_days: true, one_day: true, due_day: true, email: false }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, school, year_level, avatar_url, reminder_settings')
    .eq('id', user.id)
    .maybeSingle()

  const profile: Profile = data ?? {
    id: user.id,
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    school: null,
    year_level: null,
    avatar_url: null,
    reminder_settings: DEFAULT_REMINDERS,
  }

  return (
    <UserProvider value={{ userId: user.id, email: user.email ?? '', initialProfile: profile }}>
      <OfflineSync />
      <AppShell>{children}</AppShell>
    </UserProvider>
  )
}
