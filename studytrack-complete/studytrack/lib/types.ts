export type Priority = 'low' | 'medium' | 'high'

export type ReminderSettings = {
  three_days: boolean
  one_day: boolean
  due_day: boolean
  email: boolean
}

export type Profile = {
  id: string
  full_name: string | null
  school: string | null
  year_level: string | null
  avatar_url: string | null
  reminder_settings: ReminderSettings
}

export type Subject = {
  id: string
  name: string
  teacher: string | null
  color: string
  created_at: string
}

export type Task = {
  id: string
  subject_id: string | null
  title: string
  notes: string | null
  due_at: string
  priority: Priority
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export type ClassSession = {
  id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

export type Exam = {
  id: string
  subject_id: string
  exam_date: string
  title: string | null
}

export type ReviewSession = {
  id: string
  subject_id: string
  exam_id: string
  session_date: string
  is_done: boolean
}

export type ReviewerContent = {
  summary: string
  key_terms: { term: string; definition: string }[]
  flashcards: { question: string; answer: string }[]
  quiz: { question: string; options: string[]; answer_index: number; explanation: string }[]
}

export type Reviewer = {
  id: string
  subject_id: string | null
  title: string
  source_name: string | null
  content: ReviewerContent
  created_at: string
}
