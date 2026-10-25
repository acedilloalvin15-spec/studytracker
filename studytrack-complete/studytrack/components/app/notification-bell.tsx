'use client'

import { useRouter } from 'next/navigation'
import { Bell, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/components/app/user-provider'
import { useExams, useSubjectMap, useTasks } from '@/hooks/use-study-data'
import { daysUntil, formatDue, getUrgency, urgencyStyles } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const router = useRouter()
  const { profile } = useCurrentUser()
  const { data: tasks } = useTasks()
  const { data: exams } = useExams()
  const subjects = useSubjectMap()
  const prefs = profile.reminder_settings

  const horizonHours = prefs.three_days ? 72 : prefs.one_day ? 24 : prefs.due_day ? 0 : -1
  const now = Date.now()

  const taskAlerts = (tasks ?? [])
    .filter((t) => !t.is_completed)
    .filter((t) => {
      const hours = (new Date(t.due_at).getTime() - now) / 36e5
      if (hours < 0) return true
      if (horizonHours < 0) return false
      const sameDay = new Date(t.due_at).toDateString() === new Date().toDateString()
      return hours <= horizonHours || (prefs.due_day && sameDay)
    })
    .slice(0, 8)

  const examAlerts = (exams ?? []).filter((e) => {
    const d = daysUntil(e.exam_date)
    return d >= 0 && d <= 3
  })

  const count = taskAlerts.length + examAlerts.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${count} item${count === 1 ? '' : 's'}`} />
        }
      >
        <Bell className="size-4.5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] leading-4 font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Upcoming & overdue</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up. Nothing due soon.
          </p>
        ) : (
          <>
            {examAlerts.map((e) => {
              const s = subjects.get(e.subject_id)
              const d = daysUntil(e.exam_date)
              return (
                <DropdownMenuItem key={e.id} onClick={() => router.push('/review')} className="items-start gap-3 py-2">
                  <GraduationCap className="mt-0.5 text-primary" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="font-medium">{e.title || `${s?.name ?? 'Subject'} exam`}</span>
                    <span className="text-xs text-muted-foreground">
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
            {taskAlerts.map((t) => {
              const u = getUrgency(t.due_at)
              return (
                <DropdownMenuItem key={t.id} onClick={() => router.push('/tasks')} className="items-start gap-3 py-2">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', urgencyStyles[u].dot)} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.subject_id && subjects.get(t.subject_id) ? `${subjects.get(t.subject_id)!.name} · ` : ''}
                      {formatDue(t.due_at)}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
