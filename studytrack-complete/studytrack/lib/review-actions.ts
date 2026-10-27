'use client'

import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { generateReviewPlan } from '@/lib/review-plan'
import { toDateKey } from '@/lib/dates'
import { enqueueOps, flushQueue, isOnline, newId, pendingCount, updateRow, type QueueOp } from '@/lib/offline-queue'
import { readOffline } from '@/lib/offline'
import type { Exam, ReviewSession } from '@/lib/types'

/** Rebuilds future, unfinished review sessions while keeping completed and past ones (needs internet). */
async function regenerateOnline() {
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

/** Same plan, built from the data saved on this device. It is sent to Supabase when the connection returns. */
function regenerateOnThisDevice() {
  const todayKey = toDateKey(new Date())
  const exams = readOffline<Exam[]>('exams') ?? []
  const sessions = readOffline<ReviewSession[]>('review_sessions') ?? []
  const kept = sessions.filter((s) => s.is_done || s.session_date < todayKey)
  const plan = generateReviewPlan(exams, kept)
  const now = new Date().toISOString()
  const ops: QueueOp[] = [
    { kind: 'clearPlan', fromDate: todayKey },
    ...plan.map((p) => ({
      kind: 'insert' as const,
      table: 'review_sessions' as const,
      row: { is_done: false, ...p, id: newId(), created_at: now },
    })),
  ]
  enqueueOps(ops)
  return plan.length
}

export async function regeneratePlan() {
  await flushQueue()
  if (isOnline() && pendingCount() === 0) {
    try {
      return await regenerateOnline()
    } catch (error) {
      if (isOnline()) throw error
    }
  }
  return regenerateOnThisDevice()
}

export async function toggleSession(session: ReviewSession) {
  const result = await updateRow('review_sessions', session.id, { is_done: !session.is_done }, { optimistic: true })
  if (result === 'failed') throw new Error('Could not update the session')
}
