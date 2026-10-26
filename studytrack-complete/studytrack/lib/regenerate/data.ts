import { createClient } from '@/lib/supabase/server'

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function getReviewer(id: string, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviewers')
    .select('id, summary, key_terms, flashcards, quiz')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    summary: data.summary,
    keyTerms: data.key_terms,
    flashcards: data.flashcards ?? [],
    quiz: data.quiz ?? [],
  }
}

export async function saveReviewerSection(
  id: string,
  userId: string,
  kind: 'flashcards' | 'quiz',
  items: unknown[]
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reviewers')
    .update({ [kind]: items })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
