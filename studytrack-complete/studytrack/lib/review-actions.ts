'use client'

import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchTableRows } from '@/lib/offline-data'
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

  // Reads work offline too: they use the saved copy plus the changes made offline.
  const [exams, kept] = await Promise.all([
    fetchTableRows<Exam>('exams', 'exam_date'),
    fetchTableRows<ReviewSession>('review_sessions', 'session_date'),
  ])

  const plan = generateReviewPlan(exams, kept)
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
