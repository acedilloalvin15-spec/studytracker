import { z } from 'zod'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.email('Enter a valid email address'),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(80),
  teacher: z.string().trim().max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color'),
})

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Give your task a title').max(160),
  subject_id: z.string().optional(),
  due_date: z.string().min(1, 'Pick a due date'),
  due_time: z.string().min(1, 'Pick a time'),
  priority: z.enum(['low', 'medium', 'high']),
  notes: z.string().max(2000).optional(),
})

export const classSchema = z
  .object({
    subject_id: z.string().min(1, 'Choose a subject'),
    day_of_week: z.string().min(1, 'Choose a day'),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    room: z.string().trim().max(40).optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })

export const examSchema = z.object({
  subject_id: z.string().min(1, 'Choose a subject'),
  exam_date: z.string().min(1, 'Pick the exam date'),
  title: z.string().trim().max(80).optional(),
})

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name').max(80),
  school: z.string().trim().max(120).optional(),
  year_level: z.string().trim().max(40).optional(),
})

export const passwordSchema = resetSchema

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type SubjectValues = z.infer<typeof subjectSchema>
export type TaskValues = z.infer<typeof taskSchema>
export type ClassValues = z.infer<typeof classSchema>
export type ExamValues = z.infer<typeof examSchema>
export type ProfileValues = z.infer<typeof profileSchema>
