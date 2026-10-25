'use client'

import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { generateReviewPlan } from '@/lib/review-plan'
import { toDateKey } from '@/lib/dates'
import type { Exam, ReviewSession } from '@/lib/types'

/** Rebuilds future, unfinished review sessions while keeping completed and past ones. */
export async function regeneratePlan() {
  const supabase = createClient()
  const todayKey = toDateKey(new Date())

  const { error: delError } = await supabase
    .from('review_sessions')
    .delete()
    .eq('is_done', false)
    .gte('session_date', todayKey)
  if (delError) throw delError

  const [{ data: exams, error: e1 }, { data: kept, error: e2 }] = await Promise.all([
    supabase.from('exams').select('id, subject_id, exam_date, title'),
    supabase.from('review_sessions').select('id, subject_id, exam_id, session_date, is_done'),
  ])
  if (e1 || e2) throw e1 ?? e2

  const plan = generateReviewPlan((exams ?? []) as Exam[], (kept ?? []) as ReviewSession[])
  if (plan.length) {
    const { error } = await supabase.from('review_sessions').insert(plan)
    if (error) throw error
  }
  await Promise.all([mutate('review_sessions'), mutate('exams')])
  return plan.length
}

export async function toggleSession(session: ReviewSession) {
  const next = !session.is_done
  await mutate<ReviewSession[]>(
    'review_sessions',
    async (current) => {
      const { error } = await createClient().from('review_sessions').update({ is_done: next }).eq('id', session.id)
      if (error) throw error
      return (current ?? []).map((s) => (s.id === session.id ? { ...s, is_done: next } : s))
    },
    {
      optimisticData: (current) => (current ?? []).map((s) => (s.id === session.id ? { ...s, is_done: next } : s)),
      rollbackOnError: true,
      revalidate: false,
    },
  )
}
