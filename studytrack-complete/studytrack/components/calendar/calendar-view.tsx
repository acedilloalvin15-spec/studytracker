'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, GraduationCap, ListChecks, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, SubjectDot } from '@/components/app/shared'
import { useClasses, useExams, useSubjectMap, useTasks } from '@/hooks/use-study-data'
import { DAYS, formatDue, formatTime, isoDay, toDateKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

type DayItem = { id: string; kind: 'task' | 'class' | 'exam'; color?: string }

export function CalendarView() {
  const { data: tasks, isLoading } = useTasks()
  const { data: classes } = useClasses()
  const { data: exams } = useExams()
  const subjects = useSubjectMap()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  )

  const tasksByDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof tasks>>()
    for (const t of tasks ?? []) {
      const key = toDateKey(parseISO(t.due_at))
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [tasks])

  const examsByDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof exams>>()
    for (const e of exams ?? []) map.set(e.exam_date, [...(map.get(e.exam_date) ?? []), e])
    return map
  }, [exams])

  const classesFor = (date: Date) =>
    (classes ?? []).filter((c) => c.day_of_week === isoDay(date)).sort((a, b) => a.start_time.localeCompare(b.start_time))

  function itemsFor(date: Date): DayItem[] {
    const key = toDateKey(date)
    return [
      ...(examsByDay.get(key) ?? []).map((e) => ({ id: `e${e.id}`, kind: 'exam' as const, color: subjects.get(e.subject_id)?.color })),
      ...(tasksByDay.get(key) ?? []).filter((t) => !t.is_completed).map((t) => ({ id: `t${t.id}`, kind: 'task' as const, color: t.subject_id ? subjects.get(t.subject_id)?.color : undefined })),
      ...classesFor(date).map((c) => ({ id: `c${c.id}`, kind: 'class' as const, color: subjects.get(c.subject_id)?.color })),
    ]
  }

  const selectedKey = toDateKey(selected)
  const selectedTasks = tasksByDay.get(selectedKey) ?? []
  const selectedExams = examsByDay.get(selectedKey) ?? []
  const selectedClasses = classesFor(selected)
  const nothing = !selectedTasks.length && !selectedExams.length && !selectedClasses.length

  function showDay(date: Date) {
    setSelected(date)
    setScheduleOpen(true)
  }

  return (
    <>
      <PageHeader title="Calendar" description="Deadlines, exams, and classes together. Tap a day to see its schedule." />

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <h2 aria-live="polite">{format(month, 'MMMM yyyy')}</h2>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()) }}>
              Today
            </Button>
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {DAYS.map((d) => <div key={d.value} className="py-2">{d.short}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((date) => {
                  const items = itemsFor(date)
                  const inMonth = isSameMonth(date, month)
                  const isSelected = isSameDay(date, selected)
                  const hasExam = items.some((i) => i.kind === 'exam')
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => showDay(date)}
                      aria-label={`${format(date, 'EEEE, MMMM d')}, ${items.length} item${items.length === 1 ? '' : 's'}; open schedule`}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex min-h-14 flex-col items-center gap-1 rounded-xl border border-transparent p-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-20',
                        !inMonth && 'text-muted-foreground/50',
                        isToday(date) && 'font-bold text-primary',
                        isSelected && 'border-primary bg-primary/5',
                      )}
                    >
                      <span className={cn('flex size-6 items-center justify-center rounded-full', isToday(date) && 'bg-primary text-primary-foreground')}>
                        {format(date, 'd')}
                      </span>
                      <span className="flex flex-wrap justify-center gap-0.5" aria-hidden="true">
                        {items.slice(0, 4).map((i) => (
                          <span key={i.id} className={cn('block size-1.5 rounded-full', i.kind === 'exam' && 'ring-2 ring-urgent/60')} style={{ backgroundColor: i.color ?? 'var(--muted-foreground)' }} />
                        ))}
                      </span>
                      {hasExam && <span className="hidden text-[10px] font-semibold text-urgent md:block">Exam</span>}
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Dots use your subject colors. Dots with a red ring are exams. Select any day to view its schedule.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{format(selected, 'EEEE, MMMM d, yyyy')}</DialogTitle>
            <DialogDescription>Classes, deadlines, and exams saved for this day.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {nothing && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nothing scheduled. Enjoy the free time!</p>}

            {selectedExams.length > 0 && (
              <section aria-label="Exams">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><GraduationCap className="size-4 text-urgent" aria-hidden="true" /> Exams</h3>
                <ul className="flex flex-col gap-2">
                  {selectedExams.map((e) => {
                    const subject = subjects.get(e.subject_id)
                    return <li key={e.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-medium"><SubjectDot color={subject?.color} />{e.title || `${subject?.name ?? 'Subject'} exam`}</li>
                  })}
                </ul>
              </section>
            )}

            {selectedTasks.length > 0 && (
              <section aria-label="Deadlines">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="size-4 text-primary" aria-hidden="true" /> Deadlines</h3>
                <ul className="flex flex-col gap-2">
                  {selectedTasks.map((task) => {
                    const subject = task.subject_id ? subjects.get(task.subject_id) : undefined
                    return (
                      <li key={task.id} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                        <SubjectDot color={subject?.color} className="mt-1.5" />
                        <div className="min-w-0">
                          <p className={cn('font-medium', task.is_completed && 'text-muted-foreground line-through')}>{task.title}</p>
                          <p className="text-xs text-muted-foreground">{subject ? `${subject.name} · ` : ''}{task.is_completed ? 'Completed' : formatDue(task.due_at)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {selectedClasses.length > 0 && (
              <section aria-label="Classes">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Clock className="size-4 text-later" aria-hidden="true" /> Classes</h3>
                <ul className="flex flex-col gap-2">
                  {selectedClasses.map((classItem) => {
                    const subject = subjects.get(classItem.subject_id)
                    return (
                      <li key={classItem.id} className="rounded-xl border p-3 text-sm" style={{ borderLeftWidth: 4, borderLeftColor: subject?.color }}>
                        <p className="font-medium">{subject?.name ?? 'Class'}</p>
                        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span>{formatTime(classItem.start_time)} – {formatTime(classItem.end_time)}</span>
                          {classItem.room && <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden="true" />{classItem.room}</span>}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
