'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { saveOffline } from '@/lib/offline'
import { applyPending } from '@/lib/offline-queue'
import type {
  ClassSession,
  Exam,
  Profile,
  ReviewSession,
  Reviewer,
  Subject,
  Task,
} from '@/lib/types'

async function fetchTable<T>(table: string, order: string, ascending = true): Promise<T[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending })
  if (error) throw error
  // Changes made offline that are not sent yet stay visible until they are saved.
  const rows = applyPending(table, (data ?? []) as T[])
  saveOffline(table, rows)
  return rows
}

export function useSubjects() {
  return useSWR<Subject[]>('subjects', () => fetchTable<Subject>('subjects', 'name'))
}

export function useTasks() {
  return useSWR<Task[]>('tasks', () => fetchTable<Task>('tasks', 'due_at'))
}

export function useClasses() {
  return useSWR<ClassSession[]>('classes', () => fetchTable<ClassSession>('classes', 'start_time'))
}

export function useExams() {
  return useSWR<Exam[]>('exams', () => fetchTable<Exam>('exams', 'exam_date'))
}

export function useReviewSessions() {
  return useSWR<ReviewSession[]>('review_sessions', () =>
    fetchTable<ReviewSession>('review_sessions', 'session_date'),
  )
}

export function useProfile(userId: string, fallbackData?: Profile) {
  return useSWR<Profile>(
    ['profile', userId],
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, school, year_level, avatar_url, reminder_settings')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as Profile
    },
    { fallbackData },
  )
}

export function useSubjectMap() {
  const { data } = useSubjects()
  return new Map((data ?? []).map((s) => [s.id, s]))
}

export function useReviewers() {
  return useSWR<Reviewer[]>('reviewers', () => fetchTable<Reviewer>('reviewers', 'created_at', false))
}

export function useReviewer(id: string) {
  return useSWR<Reviewer | null>(`reviewer:${id}`, async () => {
    const { data, error } = await createClient().from('reviewers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    const reviewer = (data as Reviewer | null) ?? null
    if (reviewer) saveOffline(`reviewer:${id}`, reviewer)
    return reviewer
  })
}
