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

  return (
    <>
      <PageHeader title="Calendar" description="Deadlines, exams, and classes together. Tap a day to see the details." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
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
                  {DAYS.map((d) => (
                    <div key={d.value} className="py-2">{d.short}</div>
                  ))}
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
                        onClick={() => setSelected(date)}
                        aria-label={`${format(date, 'EEEE, MMMM d')}, ${items.length} item${items.length === 1 ? '' : 's'}`}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex min-h-14 flex-col items-center gap-1 rounded-xl border border-transparent p-1.5 text-sm transition-colors hover:bg-muted md:min-h-20',
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
                            <span
                              key={i.id}
                              className={cn('block size-1.5 rounded-full', i.kind === 'exam' && 'ring-2 ring-urgent/60')}
                              style={{ backgroundColor: i.color ?? 'var(--muted-foreground)' }}
                            />
                          ))}
                        </span>
                        {hasExam && <span className="hidden text-[10px] font-semibold text-urgent md:block">Exam</span>}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Dots use your subject colors. Dots with a red ring are exams.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit rounded-2xl">
          <CardHeader>
            <CardTitle>{format(selected, 'EEEE, MMMM d')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {nothing && <p className="text-sm text-muted-foreground">Nothing scheduled. Enjoy the free time!</p>}

            {selectedExams.length > 0 && (
              <section aria-label="Exams">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><GraduationCap className="size-4 text-urgent" aria-hidden="true" /> Exams</h3>
                <ul className="flex flex-col gap-2">
                  {selectedExams.map((e) => {
                    const s = subjects.get(e.subject_id)
                    return (
                      <li key={e.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-medium">
                        <SubjectDot color={s?.color} />
                        {e.title || `${s?.name ?? 'Subject'} exam`}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {selectedTasks.length > 0 && (
              <section aria-label="Deadlines">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="size-4 text-primary" aria-hidden="true" /> Deadlines</h3>
                <ul className="flex flex-col gap-2">
                  {selectedTasks.map((t) => {
                    const s = t.subject_id ? subjects.get(t.subject_id) : undefined
                    return (
                      <li key={t.id} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                        <SubjectDot color={s?.color} className="mt-1.5" />
                        <div className="min-w-0">
                          <p className={cn('font-medium', t.is_completed && 'text-muted-foreground line-through')}>{t.title}</p>
                          <p className="text-xs text-muted-foreground">{s ? `${s.name} · ` : ''}{t.is_completed ? 'Completed' : formatDue(t.due_at)}</p>
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
                  {selectedClasses.map((c) => {
                    const s = subjects.get(c.subject_id)
                    return (
                      <li key={c.id} className="rounded-xl border p-3 text-sm" style={{ borderLeftWidth: 4, borderLeftColor: s?.color }}>
                        <p className="font-medium">{s?.name ?? 'Class'}</p>
                        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span>{formatTime(c.start_time)} – {formatTime(c.end_time)}</span>
                          {c.room && <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden="true" />{c.room}</span>}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
