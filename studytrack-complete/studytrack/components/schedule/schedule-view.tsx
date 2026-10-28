'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookMarked, CalendarRange, Clock, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/form-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState, PageHeader } from '@/components/app/shared'
import { SelectField } from '@/components/app/select-field'
import { useClasses, useSubjectMap, useSubjects } from '@/hooks/use-study-data'
import { DAYS, formatTime, isoDay } from '@/lib/dates'
import { deleteRow, insertRow, updateRow } from '@/lib/offline-queue'
import { classSchema, type ClassValues } from '@/lib/validations'
import { cn } from '@/lib/utils'
import type { ClassSession } from '@/lib/types'

/** "08:00" becomes "08:00:00", the same shape the database returns. */
function withSeconds(time: string) {
  return time.length === 5 ? `${time}:00` : time
}

export function ScheduleView() {
  const { data: classes, isLoading } = useClasses()
  const { data: subjectList, isLoading: loadingSubjects } = useSubjects()
  const subjects = useSubjectMap()
  const [selectedDay, setSelectedDay] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClassSession | null>(null)
  const [deleting, setDeleting] = useState<ClassSession | null>(null)

  // Start on today (runs on the client only, to avoid a server/client mismatch).
  useEffect(() => {
    setSelectedDay(isoDay(new Date()))
  }, [])

  function openNew(day?: number) {
    setEditing(null)
    if (day) setSelectedDay(day)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    const result = await deleteRow('classes', deleting.id)
    if (result === 'failed') {
      toast.error('Could not delete the class.')
      return
    }
    toast.success(result === 'queued' ? 'Class removed on this device. It will sync when you are back online.' : 'Class removed')
  }

  const byDay = (day: number) =>
    (classes ?? []).filter((c) => c.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time))

  const noSubjects = !loadingSubjects && !subjectList?.length

  return (
    <>
      <PageHeader
        title="Weekly schedule"
        description="Your class timetable. It repeats every week and shows up on your dashboard."
        actions={
          !noSubjects && (
            <Button size="lg" onClick={() => openNew()}>
              <Plus aria-hidden="true" /> Add class
            </Button>
          )
        }
      />

      {noSubjects ? (
        <EmptyState
          icon={BookMarked}
          title="Add a subject first"
          description="Classes are linked to subjects, so add the subjects you take, then build your timetable."
          action={
            <Link href="/subjects" className={buttonVariants()}>
              Go to Subjects
            </Link>
          }
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Day of week" className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="tab"
                aria-selected={selectedDay === d.value}
                onClick={() => setSelectedDay(d.value)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  selectedDay === d.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {d.short}
              </button>
            ))}
          </div>

          {!classes?.length && (
            <EmptyState
              icon={CalendarRange}
              title="Your timetable is empty"
              description="Add each class with its day and time, and StudyTrack will show what is next every day."
              action={
                <Button onClick={() => openNew()}>
                  <Plus aria-hidden="true" /> Add your first class
                </Button>
              }
              className="mb-6"
            />
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {DAYS.map((d) => {
              const items = byDay(d.value)
              const isToday = d.value === isoDay(new Date())
              return (
                <section
                  key={d.value}
                  aria-label={d.long}
                  className={cn('flex-col gap-2 rounded-2xl border bg-card p-3', selectedDay === d.value ? 'flex' : 'hidden md:flex')}
                >
                  <div className="flex items-center justify-between">
                    <h2 className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                      <span className="md:hidden">{d.long}</span>
                      <span className="hidden md:inline">{d.short}</span>
                      {isToday && <span className="ml-1.5 text-xs font-normal text-muted-foreground">today</span>}
                    </h2>
                    <Button variant="ghost" size="icon-sm" aria-label={`Add class on ${d.long}`} onClick={() => openNew(d.value)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  {items.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No classes</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((c) => {
                        const s = subjects.get(c.subject_id)
                        return (
                          <li
                            key={c.id}
                            className="rounded-xl border p-2.5 text-sm"
                            style={{ borderLeftWidth: 4, borderLeftColor: s?.color, backgroundColor: s ? `${s.color}12` : undefined }}
                          >
                            <p className="font-medium break-words">{s?.name ?? 'Class'}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3 shrink-0" aria-hidden="true" />
                              {formatTime(c.start_time)} – {formatTime(c.end_time)}
                            </p>
                            {c.room && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                                {c.room}
                              </p>
                            )}
                            <div className="mt-1.5 flex gap-1">
                              <Button variant="ghost" size="icon-xs" aria-label={`Edit ${s?.name ?? 'class'}`} onClick={() => { setEditing(c); setDialogOpen(true) }}>
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button variant="ghost" size="icon-xs" aria-label={`Delete ${s?.name ?? 'class'}`} onClick={() => setDeleting(c)}>
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}

      <ClassDialog open={dialogOpen} onOpenChange={setDialogOpen} session={editing} defaultDay={selectedDay} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this class?"
        description="It will be removed from your weekly schedule."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </>
  )
}

function ClassDialog({
  open,
  onOpenChange,
  session,
  defaultDay,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  session: ClassSession | null
  defaultDay: number
}) {
  const { data: subjects } = useSubjects()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassValues>({ resolver: zodResolver(classSchema) })

  useEffect(() => {
    if (!open) return
    reset(
      session
        ? {
            subject_id: session.subject_id,
            day_of_week: String(session.day_of_week),
            start_time: session.start_time.slice(0, 5),
            end_time: session.end_time.slice(0, 5),
            room: session.room ?? '',
          }
        : { subject_id: '', day_of_week: String(defaultDay), start_time: '08:00', end_time: '09:00', room: '' },
    )
  }, [open, session, defaultDay, reset])

  async function onSubmit(values: ClassValues) {
    const payload = {
      subject_id: values.subject_id,
      day_of_week: Number(values.day_of_week),
      start_time: withSeconds(values.start_time),
      end_time: withSeconds(values.end_time),
      room: values.room?.trim() || null,
    }
    // Works offline too: the class is saved on this device and sent when the internet is back.
    const result = session ? await updateRow('classes', session.id, payload) : await insertRow('classes', payload)
    if (result === 'failed') {
      toast.error('Could not save the class. Please try again.')
      return
    }
    toast.success(
      result === 'queued'
        ? 'Class saved on this device. It will sync when you are back online.'
        : session
          ? 'Class updated'
          : 'Class added',
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit class' : 'Add a class'}</DialogTitle>
          <DialogDescription>This class repeats every week on the day you choose.</DialogDescription>
        </DialogHeader>
        <form id="class-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="class_subject" label="Subject" error={errors.subject_id?.message}>
            <Controller
              control={control}
              name="subject_id"
              render={({ field }) => (
                <SelectField
                  id="class_subject"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.subject_id}
                  placeholder="Choose a subject"
                  options={(subjects ?? []).map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                />
              )}
            />
          </FormField>
          <FormField id="class_day" label="Day" error={errors.day_of_week?.message}>
            <Controller
              control={control}
              name="day_of_week"
              render={({ field }) => (
                <SelectField
                  id="class_day"
                  value={field.value}
                  onChange={field.onChange}
                  options={DAYS.map((d) => ({ value: String(d.value), label: d.long }))}
                />
              )}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="start_time" label="Starts" error={errors.start_time?.message}>
              <Input id="start_time" type="time" className="h-10" aria-invalid={!!errors.start_time} {...register('start_time')} />
            </FormField>
            <FormField id="end_time" label="Ends" error={errors.end_time?.message}>
              <Input id="end_time" type="time" className="h-10" aria-invalid={!!errors.end_time} {...register('end_time')} />
            </FormField>
          </div>
          <FormField id="room" label="Room (optional)">
            <Input id="room" placeholder="e.g. Room 204" className="h-10" {...register('room')} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {session ? 'Save changes' : 'Add class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
