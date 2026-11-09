import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AssistantView, type AssistantMessage } from '@/components/assistant/assistant-view'

export const metadata: Metadata = { title: 'Study assistant' }

export default async function AssistantPage() {
  const supabase = await createClient()

  const [{ data: messages }, { data: reviewers }] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('id, role, content, feedback')
      .order('created_at', { ascending: true })
      .limit(100),
    supabase.from('reviewers').select('id, title').order('created_at', { ascending: false }),
  ])

  return <AssistantView initialMessages={(messages ?? []) as AssistantMessage[]} reviewers={reviewers ?? []} />
}
