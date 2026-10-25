'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SubjectTag } from '@/components/app/shared'
import { createClient } from '@/lib/supabase/client'
import { formatDue, getUrgency, urgencyStyles } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Subject, Task } from '@/lib/types'

const PRIORITY_STYLES = {
  high: 'text-urgent',
  medium: 'text-foreground/70',
  low: 'text-muted-foreground',
}

export async function toggleTask(task: Task) {
  const next = !task.is_completed
  await mutate<Task[]>(
    'tasks',
    async (current) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: next, completed_at: next ? new Date().toISOString() : null })
        .eq('id', task.id)
      if (error) throw error
      return (current ?? []).map((t) =>
        t.id === task.id ? { ...t, is_completed: next, completed_at: next ? new Date().toISOString() : null } : t,
      )
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((t) => (t.id === task.id ? { ...t, is_completed: next } : t)),
      rollbackOnError: true,
      revalidate: false,
    },
  ).then(
    () => next && toast.success('Nice work! Task completed.'),
    () => toast.error('Could not update the task.'),
  )
}

export function TaskItem({
  task,
  subject,
  onEdit,
  onDelete,
  compact,
}: {
  task: Task
  subject?: Subject
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
  compact?: boolean
}) {
  const urgency = getUrgency(task.due_at, task.is_completed)
  const style = urgencyStyles[urgency]

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors',
        !compact && 'md:p-4',
        task.is_completed && 'opacity-70',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: subject?.color ?? 'var(--border)' }}
    >
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={() => toggleTask(task)}
        aria-label={task.is_completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="mt-0.5 size-5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className={cn('font-medium leading-snug', task.is_completed && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SubjectTag subject={subject} />
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium', style.badge)}>
            <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden="true" />
            {task.is_completed ? 'Completed' : formatDue(task.due_at)}
          </span>
          {!compact && (
            <span className={cn('font-medium capitalize', PRIORITY_STYLES[task.priority])}>
              {task.priority} priority
            </span>
          )}
        </div>
        {!compact && task.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{task.notes}</p>}
      </div>
      {(onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`} />}>
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil aria-hidden="true" /> Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}
