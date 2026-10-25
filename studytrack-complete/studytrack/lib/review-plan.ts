import { addDays } from 'date-fns'
import { parseDateKey, toDateKey } from '@/lib/dates'
import type { Exam, ReviewSession } from '@/lib/types'

const MAX_SESSIONS_PER_DAY = 2

type PlannedSession = { exam_id: string; subject_id: string; session_date: string }

/**
 * Spreads review sessions across every day between today and each exam.
 * Each day picks the exams that are most "behind" (fewest sessions relative
 * to the days available), so every subject gets regular coverage, and the
 * day before an exam always includes a final review for it.
 */
export function generateReviewPlan(
  exams: Exam[],
  keptSessions: ReviewSession[],
  today = new Date(),
): PlannedSession[] {
  const todayKey = toDateKey(today)
  const upcoming = exams.filter((e) => e.exam_date > todayKey)
  if (upcoming.length === 0) return []

  const counts = new Map<string, number>()
  for (const s of keptSessions) counts.set(s.exam_id, (counts.get(s.exam_id) ?? 0) + 1)

  const occupied = new Map<string, Set<string>>()
  for (const s of keptSessions) {
    if (!occupied.has(s.session_date)) occupied.set(s.session_date, new Set())
    occupied.get(s.session_date)!.add(s.exam_id)
  }

  const lastExamKey = upcoming.reduce((max, e) => (e.exam_date > max ? e.exam_date : max), todayKey)
  const plan: PlannedSession[] = []

  for (let day = parseDateKey(todayKey); toDateKey(day) < lastExamKey; day = addDays(day, 1)) {
    const key = toDateKey(day)
    const taken = occupied.get(key) ?? new Set<string>()
    const candidates = upcoming.filter((e) => e.exam_date > key && !taken.has(e.id))
    if (candidates.length === 0) continue

    const slots = Math.max(0, MAX_SESSIONS_PER_DAY - taken.size)
    if (slots === 0) continue

    const dayBefore = toDateKey(addDays(day, 1))
    const totalDays = (e: Exam) =>
      Math.max(1, Math.round((parseDateKey(e.exam_date).getTime() - today.getTime()) / 864e5))

    const ranked = [...candidates].sort((a, b) => {
      const aFinal = a.exam_date === dayBefore ? -1 : 0
      const bFinal = b.exam_date === dayBefore ? -1 : 0
      if (aFinal !== bFinal) return aFinal - bFinal
      const aRatio = (counts.get(a.id) ?? 0) / totalDays(a)
      const bRatio = (counts.get(b.id) ?? 0) / totalDays(b)
      if (aRatio !== bRatio) return aRatio - bRatio
      return a.exam_date.localeCompare(b.exam_date)
    })

    for (const exam of ranked.slice(0, slots)) {
      plan.push({ exam_id: exam.id, subject_id: exam.subject_id, session_date: key })
      counts.set(exam.id, (counts.get(exam.id) ?? 0) + 1)
    }
  }

  return plan
}
