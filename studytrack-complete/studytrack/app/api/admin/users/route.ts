import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'Admin user management is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to your environment variables.' },
      { status: 501 },
    )
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const [{ data: authUsers, error: authError }, { data: profiles, error: profileError }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from('profiles').select('id, full_name, is_admin').order('full_name', { ascending: true, nullsFirst: false }),
  ])

  if (authError || profileError) {
    return NextResponse.json({ error: 'Could not load users.' }, { status: 500 })
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const users = (authUsers?.users ?? []).map((account) => {
    const profile = profileMap.get(account.id)
    return {
      id: account.id,
      email: account.email ?? '',
      full_name: profile?.full_name ?? null,
      is_admin: !!profile?.is_admin,
    }
  })

  return NextResponse.json({ users })
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => ({}))
  const { userId, is_admin } = payload as { userId?: string; is_admin?: boolean }

  if (!userId) {
    return NextResponse.json({ error: 'Missing user id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: requester } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!requester?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'Admin user management is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to your environment variables.' },
      { status: 501 },
    )
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.from('profiles').upsert(
    { id: userId, is_admin: !!is_admin },
    { onConflict: 'id' },
  )

  if (error) {
    return NextResponse.json({ error: 'Could not update user permissions.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
