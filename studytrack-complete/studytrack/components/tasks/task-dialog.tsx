'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/app/select-field'
import { useSubjects } from '@/hooks/use-study-data'
import { createClient } from '@/lib/supabase/client'
import { taskSchema, type TaskValues } from '@/lib/validations'
import type { Task } from '@/lib/types'

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

function defaults(task?: Task | null): TaskValues {
  if (task) {
    const due = parseISO(task.due_at)
    return {
      title: task.title,
      subject_id: task.subject_id ?? 'none',
      due_date: format(due, 'yyyy-MM-dd'),
      due_time: format(due, 'HH:mm'),
      priority: task.priority,
      notes: task.notes ?? '',
    }
  }
  return {
    title: '',
    subject_id: 'none',
    due_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    due_time: '23:59',
    priority: 'medium',
    notes: '',
  }
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
}) {
  const { data: subjects } = useSubjects()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: defaults(task) })

  useEffect(() => {
    if (open) reset(defaults(task))
  }, [open, task, reset])

  async function onSubmit(values: TaskValues) {
    const supabase = createClient()
    const payload = {
      title: values.title,
      subject_id: values.subject_id && values.subject_id !== 'none' ? values.subject_id : null,
      due_at: new Date(`${values.due_date}T${values.due_time}`).toISOString(),
      priority: values.priority,
      notes: values.notes?.trim() || null,
    }
    const { error } = task
      ? await supabase.from('tasks').update(payload).eq('id', task.id)
      : await supabase.from('tasks').insert(payload)
    if (error) {
      toast.error('Could not save the task. Please try again.')
      return
    }
    toast.success(task ? 'Task updated' : 'Task added')
    await mutate('tasks')
    onOpenChange(false)
  }

  const subjectOptions = [
    { value: 'none', label: 'No subject' },
    ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name, color: s.color })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit task' : 'Add a task'}</DialogTitle>
          <DialogDescription>Homework, projects, quizzes — anything with a deadline.</DialogDescription>
        </DialogHeader>
        <form id="task-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="title" label="Title" error={errors.title?.message}>
            <Input id="title" placeholder="e.g. Chapter 5 reading questions" className="h-10" aria-invalid={!!errors.title} {...register('title')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="subject_id" label="Subject">
              <Controller
                control={control}
                name="subject_id"
                render={({ field }) => (
                  <SelectField id="subject_id" value={field.value} onChange={field.onChange} options={subjectOptions} />
                )}
              />
            </FormField>
            <FormField id="priority" label="Priority">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <SelectField id="priority" value={field.value} onChange={field.onChange} options={PRIORITIES} />
                )}
              />
            </FormField>
            <FormField id="due_date" label="Due date" error={errors.due_date?.message}>
              <Input id="due_date" type="date" className="h-10" aria-invalid={!!errors.due_date} {...register('due_date')} />
            </FormField>
            <FormField id="due_time" label="Due time" error={errors.due_time?.message}>
              <Input id="due_time" type="time" className="h-10" aria-invalid={!!errors.due_time} {...register('due_time')} />
            </FormField>
          </div>
          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={3} placeholder="Page numbers, rubric details, group members…" {...register('notes')} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
