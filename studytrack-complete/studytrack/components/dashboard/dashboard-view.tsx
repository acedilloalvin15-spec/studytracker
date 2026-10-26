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
import { HeaderContent } from '@/components/app/header-slots'
import { useCurrentUser } from '@/components/app/user-provider'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { TaskItem } from '@/components/tasks/task-item'
import { useClasses, useExams, useReviewSessions, useSubjectMap, useTasks } from '@/hooks/use-study-data'
import { formatTime, isDueToday, isOverdue, isThisWeek, isoDay, toDateKey } from '@/lib/dates'
import { toggleSession } from '@/lib/review-actions'
import { cn } from '@/lib/utils'

const panel = 'rounded-3xl border-0 bg-white/80 shadow-sm ring-0 dark:bg-card/80'
const softRow = 'rounded-2xl bg-muted/50'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-3 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-white/10"
      style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 3px, rgba(120,100,200,0.12) 3px 5px)' }}
    >
      <div className="h-full rounded-full bg-violet-300 transition-all dark:bg-violet-400" style={{ width: `${percent}%` }} />
    </div>
  )
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
  const dueToday = open.filter((t) => isDueToday(t.due_at) && !isOverdue(t.due_at)).length
  const dueWeek = open.filter((t) => isThisWeek(t.due_at) && !isOverdue(t.due_at)).length
  const overdue = open.filter((t) => isOverdue(t.due_at)).length
  const doneWeek = (tasks ?? []).filter(
    (t) => t.is_completed && t.completed_at && dfIsThisWeek(parseISO(t.completed_at), { weekStartsOn: 1 }),
  ).length
  const doneAll = (tasks ?? []).filter((t) => t.is_completed).length

  const stats = [
    { label: 'Due today', value: dueToday, icon: CalendarCheck2, dot: 'bg-primary', note: `${open.length} open in total` },
    { label: 'Due this week', value: dueWeek, icon: ListChecks, dot: 'bg-soon', note: 'This week' },
    { label: 'Overdue', value: overdue, icon: AlarmClock, dot: overdue > 0 ? 'bg-urgent' : 'bg-later', note: overdue > 0 ? 'Needs attention' : 'All caught up' },
    { label: 'Done this week', value: doneWeek, icon: CheckCircle2, dot: 'bg-later', note: `${doneAll} all time` },
  ]

  const weekTotal = doneWeek + dueWeek
  const weekPercent = weekTotal === 0 ? 0 : Math.round((doneWeek / weekTotal) * 100)

  const upcoming = [...open].sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 6)
  const today = isoDay(new Date())
  const todaysClasses = (classes ?? []).filter((c) => c.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const todayKey = toDateKey(new Date())
  const todaysReview = (sessions ?? []).filter((s) => s.session_date === todayKey)
  const reviewDone = todaysReview.filter((r) => r.is_done).length
  const examById = new Map((exams ?? []).map((e) => [e.id, e]))
  const firstName = profile.full_name?.split(' ')[0]

  return (
    <>
      <HeaderContent
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={format(new Date(), 'EEEE, MMMM d')}
        actions={
          <Button variant="dark" size="lg" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" /> Add task
          </Button>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, dot, note }) => (
          <Card key={label} className={panel}>
            <CardContent className="flex flex-col gap-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </p>
              <div className="flex flex-wrap items-end justify-between gap-2">
                {loadingTasks ? (
                  <Skeleton className="h-10 w-12" />
                ) : (
                  <p className="text-5xl leading-none font-light tabular-nums">{value}</p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
                  {note}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:mt-6 md:gap-6 lg:grid-cols-5">
        <Card className={cn(panel, 'lg:col-span-3')}>
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

        <div className="flex flex-col gap-4 md:gap-6 lg:col-span-2">
          <Card className={panel}>
            <CardHeader>
              <CardTitle>Weekly progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingTasks ? (
                <Skeleton className="h-3 w-full rounded-full" />
              ) : (
                <>
                  <ProgressBar percent={weekPercent} />
                  <p className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{weekTotal === 0 ? 'No tasks planned this week' : `${doneWeek} of ${weekTotal} tasks done`}</span>
                    <span>{weekPercent}%</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={panel}>
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
                      <li key={c.id} className={cn(softRow, 'flex items-center gap-3 border-0 p-3')} style={{ borderLeftWidth: 4, borderLeftColor: s?.color }}>
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

          <Card className={panel}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Today&apos;s review plan</CardTitle>
              <div className="flex items-center gap-2">
                {todaysReview.length > 0 && (
                  <span className="text-xs text-muted-foreground">{reviewDone}/{todaysReview.length} done</span>
                )}
                <Link href="/review" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-primary')}>
                  Planner <ArrowRight aria-hidden="true" />
                </Link>
              </div>
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
                        <label className={cn(softRow, 'flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted')}>
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
