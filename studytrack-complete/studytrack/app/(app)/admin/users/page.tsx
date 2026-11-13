import { redirect } from 'next/navigation'
import { AdminUsersView } from '@/components/admin/admin-users-view'
import { createClient } from '@/lib/supabase/server'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) redirect('/dashboard')

  return <AdminUsersView />
}
