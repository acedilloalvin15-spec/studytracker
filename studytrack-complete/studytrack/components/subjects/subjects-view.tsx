'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookMarked, Check, Loader2, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState, PageHeader } from '@/components/app/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { useClasses, useSubjects, useTasks } from '@/hooks/use-study-data'
import { createClient } from '@/lib/supabase/client'
import { subjectSchema, type SubjectValues } from '@/lib/validations'
import { cn } from '@/lib/utils'
import type { Subject } from '@/lib/types'

const PALETTE = ['#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#ea580c', '#dc2626', '#db2777', '#9333ea']

export function SubjectsView() {
  const { data: subjects, isLoading } = useSubjects()
  const { data: tasks } = useTasks()
  const { data: classes } = useClasses()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    const { error } = await createClient().from('subjects').delete().eq('id', deleting.id)
    if (error) {
      toast.error('Could not delete the subject.')
      return
    }
    toast.success(`${deleting.name} deleted`)
    await Promise.all(['subjects', 'tasks', 'classes', 'exams', 'review_sessions'].map((k) => mutate(k)))
  }

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Your classes and their colors. Colors show up everywhere in StudyTrack."
        actions={
          <Button size="lg" onClick={openNew}>
            <Plus aria-hidden="true" /> Add subject
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !subjects?.length ? (
        <EmptyState
          icon={BookMarked}
          title="Add your first subject"
          description="Start with the classes you're taking this semester, like Biology, Algebra II, or World History."
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden="true" /> Add subject
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const open = (tasks ?? []).filter((t) => t.subject_id === s.id && !t.is_completed).length
            const weekly = (classes ?? []).filter((c) => c.subject_id === s.id).length
            return (
              <li key={s.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
                <div className="h-2" style={{ backgroundColor: s.color }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{s.name}</h2>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UserRound className="size-3.5" aria-hidden="true" />
                        {s.teacher || 'No teacher added'}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setOpen(true) }}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-4 text-sm text-muted-foreground">
                    <span><span className="font-semibold text-foreground">{open}</span> open task{open === 1 ? '' : 's'}</span>
                    <span><span className="font-semibold text-foreground">{weekly}</span> class{weekly === 1 ? '' : 'es'}/week</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SubjectDialog open={open} onOpenChange={setOpen} subject={editing} usedColors={(subjects ?? []).map((s) => s.color)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'subject'}?`}
        description="Its classes, exams, and review sessions will be deleted too. Tasks stay, but lose their subject."
        onConfirm={confirmDelete}
      />
    </>
  )
}

function SubjectDialog({
  open,
  onOpenChange,
  subject,
  usedColors,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subject: Subject | null
  usedColors: string[]
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectValues>({ resolver: zodResolver(subjectSchema) })

  useEffect(() => {
    if (!open) return
    reset(
      subject
        ? { name: subject.name, teacher: subject.teacher ?? '', color: subject.color }
        : { name: '', teacher: '', color: PALETTE.find((c) => !usedColors.includes(c)) ?? PALETTE[0] },
    )
  }, [open, subject, reset, usedColors])

  async function onSubmit(values: SubjectValues) {
    const supabase = createClient()
    const payload = { name: values.name, teacher: values.teacher || null, color: values.color }
    const { error } = subject
      ? await supabase.from('subjects').update(payload).eq('id', subject.id)
      : await supabase.from('subjects').insert(payload)
    if (error) {
      toast.error('Could not save the subject.')
      return
    }
    toast.success(subject ? 'Subject updated' : `${values.name} added`)
    await mutate('subjects')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? 'Edit subject' : 'Add a subject'}</DialogTitle>
          <DialogDescription>Pick a color you&apos;ll recognize in your schedule and calendar.</DialogDescription>
        </DialogHeader>
        <form id="subject-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="name" label="Subject name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. General Chemistry" className="h-10" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField id="teacher" label="Teacher (optional)">
            <Input id="teacher" placeholder="e.g. Ms. Reyes" className="h-10" {...register('teacher')} />
          </FormField>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Color</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      aria-label={`Color ${c}`}
                      aria-pressed={field.value === c}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        field.value === c && 'ring-2 ring-foreground',
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {field.value === c && <Check className="size-4 text-white" aria-hidden="true" />}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="color"
                      value={field.value ?? '#4f46e5'}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="size-8 cursor-pointer rounded-full border bg-transparent"
                      aria-label="Custom color"
                    />
                    Custom
                  </label>
                </div>
                {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
              </fieldset>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="subject-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {subject ? 'Save changes' : 'Add subject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
