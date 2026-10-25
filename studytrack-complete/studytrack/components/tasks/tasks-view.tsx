'use client'

import { useMemo, useState } from 'react'
import { ListChecks, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ListSkeleton, PageHeader } from '@/components/app/shared'
import { SelectField } from '@/components/app/select-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { TaskItem } from '@/components/tasks/task-item'
import { useSubjectMap, useTasks } from '@/hooks/use-study-data'
import { isDueToday, isOverdue, isThisWeek } from '@/lib/dates'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
] as const

type Filter = (typeof FILTERS)[number]['id']
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export function TasksView() {
  const { data: tasks, isLoading } = useTasks()
  const subjects = useSubjectMap()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('due')
  const [editing, setEditing] = useState<Task | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (tasks ?? [])
      .filter((t) => {
        switch (filter) {
          case 'today':
            return !t.is_completed && isDueToday(t.due_at)
          case 'week':
            return !t.is_completed && isThisWeek(t.due_at)
          case 'overdue':
            return !t.is_completed && isOverdue(t.due_at)
          case 'completed':
            return t.is_completed
          default:
            return true
        }
      })
      .filter((t) => {
        if (!q) return true
        const subjectName = t.subject_id ? subjects.get(t.subject_id)?.name ?? '' : ''
        return `${t.title} ${t.notes ?? ''} ${subjectName}`.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (filter === 'all' && a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
        if (sort === 'priority' && a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        return a.due_at.localeCompare(b.due_at)
      })
  }, [tasks, filter, query, sort, subjects])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    const supabase = createClient()
    const { error } = await supabase.from('tasks').delete().eq('id', deleting.id)
    if (error) {
      toast.error('Could not delete the task.')
      return
    }
    toast.success('Task deleted')
    await mutate('tasks')
  }

  return (
    <>
      <PageHeader
        title="Deadlines"
        description="Every assignment in one list, sorted so the urgent stuff comes first."
        actions={
          <Button size="lg" onClick={openNew}>
            <Plus aria-hidden="true" /> Add task
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search tasks or subjects"
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <SelectField
          value={sort}
          onChange={setSort}
          ariaLabel="Sort tasks"
          className="md:w-48"
          options={[
            { value: 'due', label: 'Sort by due date' },
            { value: 'priority', label: 'Sort by priority' },
          ]}
        />
      </div>

      <div role="group" aria-label="Filter tasks" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={tasks?.length ? 'No tasks match' : 'No tasks yet'}
          description={
            tasks?.length
              ? 'Try a different filter or search term.'
              : 'Add your first assignment and StudyTrack will keep an eye on the deadline for you.'
          }
          action={
            !tasks?.length && (
              <Button onClick={openNew}>
                <Plus aria-hidden="true" /> Add your first task
              </Button>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              subject={t.subject_id ? subjects.get(t.subject_id) : undefined}
              onEdit={(task) => {
                setEditing(task)
                setDialogOpen(true)
              }}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      )}

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this task?"
        description={`"${deleting?.title ?? ''}" will be permanently removed.`}
        onConfirm={confirmDelete}
      />
    </>
  )
}
