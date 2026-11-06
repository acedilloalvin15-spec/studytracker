'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchTableRows } from '@/lib/offline-data'
import type {
  ClassSession,
  Exam,
  Profile,
  ReviewSession,
  Reviewer,
  Subject,
  Task,
} from '@/lib/types'

function fetchTable<T>(table: string, order: string, ascending = true): Promise<T[]> {
  return fetchTableRows<T>(table, order, ascending)
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

/** One reviewer, taken from the saved list so it also works offline and right after it is made. */
export function useReviewer(id: string) {
  const list = useReviewers()
  const reviewer = list.data?.find((r) => r.id === id) ?? null
  return { data: reviewer, isLoading: list.isLoading, revalidate: list.mutate }
}
