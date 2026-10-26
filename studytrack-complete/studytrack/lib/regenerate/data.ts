import { createClient } from '@/lib/supabase/server'

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Ownership is enforced by your Supabase row-level security (same as the Delete button).
export async function getReviewer(id: string, _userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviewers')
    .select('id, content')
    .eq('id', id)
    .single()
  if (error || !data) return null
  const c = (data.content ?? {}) as any
  return {
    id: data.id as string,
    summary: (c.summary ?? '') as string,
    keyTerms: c.key_terms ?? [],
    flashcards: (c.flashcards ?? []) as any[],
    quiz: (c.quiz ?? []) as any[],
  }
}

export async function saveReviewerSection(
  id: string,
  _userId: string,
  kind: 'flashcards' | 'quiz',
  items: unknown[]
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviewers')
    .select('content')
    .eq('id', id)
    .single()
  if (error || !data) throw error ?? new Error('Reviewer not found')

  const content = { ...(data.content as object), [kind]: items }
  const { error: updateError } = await supabase
    .from('reviewers')
    .update({ content })
    .eq('id', id)
  if (updateError) throw updateError
}
