import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f-]{36}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 })

  let body: { id?: unknown; feedback?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
  const value = body.feedback === 1 || body.feedback === -1 ? body.feedback : null
  if (!id || value === null) return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 })

  // Only assistant answers can be rated, and Row Level Security keeps this to the student's own rows.
  const { error } = await supabase
    .from('assistant_messages')
    .update({ feedback: value })
    .eq('id', id)
    .eq('role', 'assistant')
  if (error) return NextResponse.json({ error: 'Could not save feedback.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
