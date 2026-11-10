import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { answerQuestion, type ReviewerInput } from '@/lib/assistant/engine'
import type { ReviewerContent } from '@/lib/types'

export const runtime = 'nodejs'

const MAX_MESSAGE_CHARS = 1000
const UUID = /^[0-9a-f-]{36}$/i

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Please log in first.', 401)

  let body: { message?: unknown; reviewerId?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('Could not read your message. Please try again.')
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return fail('Please type a question first.')
  if (message.length > MAX_MESSAGE_CHARS) return fail(`Please keep your message under ${MAX_MESSAGE_CHARS} characters.`)

  const reviewerId = typeof body.reviewerId === 'string' && UUID.test(body.reviewerId) ? body.reviewerId : null

  // Row Level Security makes sure only this student's reviewers are returned.
  let reviewer: ReviewerInput | null = null
  if (reviewerId) {
    const { data } = await supabase.from('reviewers').select('title, content').eq('id', reviewerId).maybeSingle()
    if (data) reviewer = { title: data.title as string, content: data.content as ReviewerContent }
  }

  const reply = await answerQuestion(message, reviewer)

  const { data: saved, error } = await supabase
    .from('assistant_messages')
    .insert([
      { user_id: user.id, role: 'user', content: message, reviewer_id: reviewerId },
      { user_id: user.id, role: 'assistant', content: reply.slice(0, 4000), reviewer_id: reviewerId },
    ])
    .select('id, role, content, feedback, created_at')

  if (error || !saved) return NextResponse.json({ reply: { role: 'assistant', content: reply } })

  return NextResponse.json({ reply: saved.find((m) => m.role === 'assistant') })
}

/** Clears this student's assistant chat. Only their own rows are removed. */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Please log in first.', 401)

  const { error } = await supabase.from('assistant_messages').delete().eq('user_id', user.id)
  if (error) return fail('Could not clear the chat. Please try again.', 500)
  return NextResponse.json({ ok: true })
}
