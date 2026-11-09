import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askAssistant, assistantConfigured, AssistantError, buildSystemPrompt, type ChatTurn } from '@/lib/assistant/ai'
import { findHelpArticles } from '@/lib/assistant/knowledge'
import type { ReviewerContent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGE_CHARS = 1000
const HISTORY_TURNS = 8
const MAX_REVIEWER_CHARS = 8000
const UUID = /^[0-9a-f-]{36}$/i

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function dailyLimit() {
  const n = Number(process.env.ASSISTANT_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? n : 30
}

/** Turns a saved reviewer into plain text the assistant can read. */
function reviewerToText(content: ReviewerContent): string {
  const parts: string[] = []
  if (content.summary) parts.push(`Summary: ${content.summary}`)
  if (content.key_terms?.length) {
    parts.push('Key terms:\n' + content.key_terms.map((t) => `- ${t.term}: ${t.definition}`).join('\n'))
  }
  if (content.flashcards?.length) {
    parts.push('Flashcards:\n' + content.flashcards.map((f) => `- Q: ${f.question} A: ${f.answer}`).join('\n'))
  }
  if (content.quiz?.length) {
    parts.push(
      'Quiz (with correct answers):\n' +
        content.quiz
          .map((q, i) => `${i + 1}. ${q.question} Options: ${q.options.join(' / ')}. Correct: ${q.options[q.answer_index]}. ${q.explanation ?? ''}`)
          .join('\n'),
    )
  }
  return parts.join('\n\n').slice(0, MAX_REVIEWER_CHARS)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Please log in first.', 401)

  if (!assistantConfigured()) {
    return fail('The study assistant is not set up yet. Please ask the site owner to add the AI key.', 503)
  }

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

  // Daily limit per student, to control AI costs.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: usedToday } = await supabase
    .from('assistant_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', since)
  if ((usedToday ?? 0) >= dailyLimit()) {
    return fail(`You have reached today's limit of ${dailyLimit()} questions. Please try again tomorrow.`, 429)
  }

  // The chosen reviewer. Row Level Security makes sure only this student's reviewers are returned.
  let reviewerContext: string | undefined
  if (reviewerId) {
    const { data: reviewer } = await supabase.from('reviewers').select('title, content').eq('id', reviewerId).maybeSingle()
    if (reviewer) {
      reviewerContext = `Title: ${reviewer.title}\n${reviewerToText(reviewer.content as ReviewerContent)}`
    }
  }

  // Recent conversation, so follow-up questions make sense.
  const { data: recent } = await supabase
    .from('assistant_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS)
  const history: ChatTurn[] = (recent ?? [])
    .reverse()
    .map((m) => ({ role: m.role as ChatTurn['role'], content: m.content as string }))

  const turns: ChatTurn[] = [...history, { role: 'user', content: message }]
  const system = buildSystemPrompt(findHelpArticles(message), reviewerContext)

  let reply: string
  try {
    reply = await askAssistant(system, turns)
  } catch (err) {
    if (err instanceof AssistantError && err.code === 'busy') {
      return fail('The assistant is busy right now. Please try again in a minute.', 503)
    }
    return fail('The assistant could not answer right now. Please try again.', 502)
  }

  // Save both sides of the conversation only after a good answer, so failed tries do not use up the limit.
  const { data: saved, error } = await supabase
    .from('assistant_messages')
    .insert([
      { user_id: user.id, role: 'user', content: message, reviewer_id: reviewerId },
      { user_id: user.id, role: 'assistant', content: reply.slice(0, 4000), reviewer_id: reviewerId },
    ])
    .select('id, role, content, feedback, created_at')

  if (error || !saved) return NextResponse.json({ reply: { role: 'assistant', content: reply } })

  const assistantMessage = saved.find((m) => m.role === 'assistant')
  return NextResponse.json({ reply: assistantMessage })
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
