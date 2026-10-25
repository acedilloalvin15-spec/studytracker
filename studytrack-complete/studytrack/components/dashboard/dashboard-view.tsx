'use client'

import Link from 'next/link'
import { useState } from 'react'
import { format, isThisWeek as dfIsThisWeek, parseISO } from 'date-fns'
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  Clock,
  GraduationCap,
  ListChecks,
  MapPin,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ListSkeleton, SubjectDot } from '@/components/app/shared'
import { useCurrentUser } from '@/components/app/user-provider'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { TaskItem } from '@/components/tasks/task-item'
import { useClasses, useExams, useReviewSessions, useSubjectMap, useTasks } from '@/hooks/use-study-data'
import { formatTime, isDueToday, isOverdue, isThisWeek, isoDay, toDateKey } from '@/lib/dates'
import { toggleSession } from '@/lib/review-actions'
import { cn } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardView() {
  const { profile } = useCurrentUser()
  const { data: tasks, isLoading: loadingTasks } = useTasks()
  const { data: classes, isLoading: loadingClasses } = useClasses()
  const { data: sessions, isLoading: loadingSessions } = useReviewSessions()
  const { data: exams } = useExams()
  const subjects = useSubjectMap()
  const [addOpen, setAddOpen] = useState(false)

  const open = (tasks ?? []).filter((t) => !t.is_completed)
  const stats = [
    { label: 'Due today', value: open.filter((t) => isDueToday(t.due_at) && !isOverdue(t.due_at)).length, icon: CalendarCheck2, tone: 'text-primary bg-primary/10' },
    { label: 'Due this week', value: open.filter((t) => isThisWeek(t.due_at) && !isOverdue(t.due_at)).length, icon: ListChecks, tone: 'text-soon bg-soon/15' },
    { label: 'Overdue', value: open.filter((t) => isOverdue(t.due_at)).length, icon: AlarmClock, tone: 'text-urgent bg-urgent/10' },
    {
      label: 'Done this week',
      value: (tasks ?? []).filter((t) => t.is_completed && t.completed_at && dfIsThisWeek(parseISO(t.completed_at), { weekStartsOn: 1 })).length,
      icon: CheckCircle2,
      tone: 'text-later bg-later/10',
    },
  ]

  const upcoming = [...open].sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 6)
  const today = isoDay(new Date())
  const todaysClasses = (classes ?? []).filter((c) => c.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const todayKey = toDateKey(new Date())
  const todaysReview = (sessions ?? []).filter((s) => s.session_date === todayKey)
  const examById = new Map((exams ?? []).map((e) => [e.id, e]))
  const firstName = profile.full_name?.split(' ')[0]

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" /> Add task
        </Button>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="flex flex-col gap-3">
              <span className={cn('flex size-9 items-center justify-center rounded-xl', tone)}>
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              {loadingTasks ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-3xl font-bold tabular-nums">{value}</p>
              )}
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="rounded-2xl lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming deadlines</CardTitle>
            <Link href="/tasks" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-primary')}>
              View all <ArrowRight aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <ListSkeleton rows={4} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing due — enjoy it"
                description="When a teacher announces a new assignment, add it here so you never lose track."
                action={<Button variant="outline" onClick={() => setAddOpen(true)}>Add a task</Button>}
                className="border-none py-8"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((t) => (
                  <TaskItem key={t.id} task={t} subject={t.subject_id ? subjects.get(t.subject_id) : undefined} compact />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Today&apos;s classes</CardTitle>
              <Link href="/schedule" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-primary')}>
                Schedule <ArrowRight aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingClasses ? (
                <ListSkeleton rows={2} />
              ) : todaysClasses.length === 0 ? (
                <EmptyState icon={CalendarRange} title="No classes today" description="Free day! Add your timetable in Schedule to see classes here." className="border-none py-6" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {todaysClasses.map((c) => {
                    const s = subjects.get(c.subject_id)
                    return (
                      <li key={c.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderLeftWidth: 4, borderLeftColor: s?.color }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s?.name ?? 'Class'}</p>
                          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />{formatTime(c.start_time)} – {formatTime(c.end_time)}</span>
                            {c.room && <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden="true" />{c.room}</span>}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Today&apos;s review plan</CardTitle>
              <Link href="/review" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-primary')}>
                Planner <ArrowRight aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <ListSkeleton rows={2} />
              ) : todaysReview.length === 0 ? (
                <EmptyState icon={GraduationCap} title="No review sessions today" description="Add an upcoming exam and StudyTrack will plan your review days." className="border-none py-6" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {todaysReview.map((r) => {
                    const s = subjects.get(r.subject_id)
                    const exam = examById.get(r.exam_id)
                    return (
                      <li key={r.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/50">
                          <Checkbox
                            checked={r.is_done}
                            onCheckedChange={() => toggleSession(r).catch(() => toast.error('Could not update session.'))}
                            className="size-5"
                          />
                          <SubjectDot color={s?.color} />
                          <span className={cn('flex-1 font-medium', r.is_done && 'line-through text-muted-foreground')}>
                            Review {s?.name ?? 'subject'}
                          </span>
                          {exam && <span className="text-xs text-muted-foreground">Exam {format(parseISO(exam.exam_date), 'MMM d')}</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
