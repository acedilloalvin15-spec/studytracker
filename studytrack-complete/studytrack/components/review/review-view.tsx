'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { BookMarked, CalendarClock, FileText, GraduationCap, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/form-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState, PageHeader, SubjectDot } from '@/components/app/shared'
import { SelectField } from '@/components/app/select-field'
import { useExams, useReviewSessions, useSubjectMap, useSubjects } from '@/hooks/use-study-data'
import { daysUntil, toDateKey } from '@/lib/dates'
import { regeneratePlan, toggleSession } from '@/lib/review-actions'
import { createClient } from '@/lib/supabase/client'
import { examSchema, type ExamValues } from '@/lib/validations'
import { cn } from '@/lib/utils'
import type { Exam } from '@/lib/types'

function dayLabel(dateKey: string) {
  const d = daysUntil(dateKey)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return format(parseISO(dateKey), 'EEEE, MMM d')
}

export function ReviewView() {
  const { data: exams, isLoading: loadingExams } = useExams()
  const { data: sessions, isLoading: loadingSessions } = useReviewSessions()
  const { data: subjectList, isLoading: loadingSubjects } = useSubjects()
  const subjects = useSubjectMap()
  const [examOpen, setExamOpen] = useState(false)
  const [deleting, setDeleting] = useState<Exam | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const todayKey = toDateKey(new Date())
  const upcomingExams = useMemo(
    () => (exams ?? []).filter((e) => e.exam_date >= todayKey).sort((a, b) => a.exam_date.localeCompare(b.exam_date)),
    [exams, todayKey],
  )

  const progress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const s of sessions ?? []) {
      const p = map.get(s.exam_id) ?? { done: 0, total: 0 }
      p.total += 1
      if (s.is_done) p.done += 1
      map.set(s.exam_id, p)
    }
    return map
  }, [sessions])

  const grouped = useMemo(() => {
    const upcomingIds = new Set(upcomingExams.map((e) => e.id))
    const days = new Map<string, NonNullable<typeof sessions>>()
    for (const s of sessions ?? []) {
      if (s.session_date < todayKey || !upcomingIds.has(s.exam_id)) continue
      days.set(s.session_date, [...(days.get(s.session_date) ?? []), s])
    }
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [sessions, upcomingExams, todayKey])

  async function handleRegenerate(silent = false) {
    setRegenerating(true)
    try {
      const count = await regeneratePlan()
      if (!silent) toast.success(count ? `Plan updated with ${count} review session${count === 1 ? '' : 's'}` : 'Nothing to plan yet. Add an upcoming exam first.')
    } catch {
      toast.error('Could not update the plan. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const { error } = await createClient().from('exams').delete().eq('id', deleting.id)
    if (error) {
      toast.error('Could not delete the exam.')
      return
    }
    toast.success('Exam deleted')
    await Promise.all([mutate('exams'), mutate('review_sessions')])
  }

  const loading = loadingExams || loadingSessions || loadingSubjects
  const noSubjects = !loadingSubjects && !subjectList?.length

  return (
    <>
      <PageHeader
        title="Review planner"
        description="Add your exams and StudyTrack spreads review sessions across every subject so none get forgotten."
        actions={
          !noSubjects && (
            <>
              <Link href="/reviewers" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                <FileText aria-hidden="true" /> Reviewer maker
              </Link>
              <Button variant="outline" size="lg" onClick={() => handleRegenerate()} disabled={regenerating || !upcomingExams.length}>
                {regenerating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                Regenerate plan
              </Button>
              <Button size="lg" onClick={() => setExamOpen(true)}>
                <Plus aria-hidden="true" /> Add exam
              </Button>
            </>
          )
        }
      />

      {noSubjects ? (
        <EmptyState
          icon={BookMarked}
          title="Add a subject first"
          description="Exams belong to a subject, so add the subjects you take before planning your review."
          action={
            <Link href="/subjects" className={buttonVariants()}>
              Go to Subjects
            </Link>
          }
        />
      ) : loading ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-3" />
        </div>
      ) : upcomingExams.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No upcoming exams"
          description="Add an exam date for each subject. The planner then builds a day-by-day review schedule for you."
          action={
            <Button onClick={() => setExamOpen(true)}>
              <Plus aria-hidden="true" /> Add your first exam
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle>Upcoming exams</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {upcomingExams.map((e) => {
                  const s = subjects.get(e.subject_id)
                  const p = progress.get(e.id) ?? { done: 0, total: 0 }
                  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
                  const d = daysUntil(e.exam_date)
                  return (
                    <li key={e.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            <SubjectDot color={s?.color} />
                            <span className="truncate">{e.title || `${s?.name ?? 'Subject'} exam`}</span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="size-3" aria-hidden="true" />
                            {format(parseISO(e.exam_date), 'EEE, MMM d')} · {d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${e.title || s?.name || 'exam'}`} onClick={() => setDeleting(e)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{p.total ? `${p.done} of ${p.total} sessions done` : 'No sessions yet'}</span>
                          <span>{pct}%</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`Review progress for ${s?.name ?? 'exam'}`}
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2 overflow-hidden rounded-full bg-muted"
                        >
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s?.color ?? 'var(--primary)' }} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl lg:col-span-3">
            <CardHeader>
              <CardTitle>Day-by-day plan</CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <EmptyState
                  icon={RefreshCw}
                  title="No review sessions yet"
                  description="Press the button to build your plan from your exam dates."
                  action={
                    <Button onClick={() => handleRegenerate()} disabled={regenerating}>
                      {regenerating && <Loader2 className="animate-spin" aria-hidden="true" />}
                      Generate my plan
                    </Button>
                  }
                  className="border-none py-8"
                />
              ) : (
                <ol className="flex flex-col gap-5">
                  {grouped.map(([date, items]) => (
                    <li key={date}>
                      <h3 className={cn('mb-2 text-sm font-semibold', date === todayKey && 'text-primary')}>{dayLabel(date)}</h3>
                      <ul className="flex flex-col gap-2">
                        {items.map((r) => {
                          const s = subjects.get(r.subject_id)
                          return (
                            <li key={r.id}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/50">
                                <Checkbox
                                  checked={r.is_done}
                                  onCheckedChange={() => toggleSession(r).catch(() => toast.error('Could not update session.'))}
                                  className="size-5"
                                />
                                <SubjectDot color={s?.color} />
                                <span className={cn('flex-1 font-medium', r.is_done && 'text-muted-foreground line-through')}>
                                  Review {s?.name ?? 'subject'}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ExamDialog open={examOpen} onOpenChange={setExamOpen} onCreated={() => handleRegenerate(true)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this exam?"
        description="Its review sessions will be deleted too."
        onConfirm={confirmDelete}
      />
    </>
  )
}

function ExamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => Promise<void>
}) {
  const { data: subjects } = useSubjects()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExamValues>({ resolver: zodResolver(examSchema) })

  useEffect(() => {
    if (open) reset({ subject_id: '', exam_date: '', title: '' })
  }, [open, reset])

  async function onSubmit(values: ExamValues) {
    if (values.exam_date < toDateKey(new Date())) {
      toast.error('Pick an exam date that is today or later.')
      return
    }
    const { error } = await createClient()
      .from('exams')
      .insert({ subject_id: values.subject_id, exam_date: values.exam_date, title: values.title?.trim() || null })
    if (error) {
      toast.error('Could not save the exam. Please try again.')
      return
    }
    toast.success('Exam added. Building your plan…')
    await mutate('exams')
    onOpenChange(false)
    await onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an exam</DialogTitle>
          <DialogDescription>Your review plan is rebuilt automatically after you add it.</DialogDescription>
        </DialogHeader>
        <form id="exam-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="exam_subject" label="Subject" error={errors.subject_id?.message}>
            <Controller
              control={control}
              name="subject_id"
              render={({ field }) => (
                <SelectField
                  id="exam_subject"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.subject_id}
                  placeholder="Choose a subject"
                  options={(subjects ?? []).map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                />
              )}
            />
          </FormField>
          <FormField id="exam_date" label="Exam date" error={errors.exam_date?.message}>
            <Input id="exam_date" type="date" className="h-10" min={toDateKey(new Date())} aria-invalid={!!errors.exam_date} {...register('exam_date')} />
          </FormField>
          <FormField id="exam_title" label="Exam name (optional)" error={errors.title?.message}>
            <Input id="exam_title" placeholder="e.g. Midterm exam" className="h-10" {...register('title')} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="exam-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Add exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
