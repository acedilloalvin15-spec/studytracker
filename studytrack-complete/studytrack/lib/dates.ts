import {
  differenceInCalendarDays,
  endOfWeek,
  format,
  isPast,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'

export const DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 7, short: 'Sun', long: 'Sunday' },
]

export function isoDay(date: Date) {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

export function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function parseDateKey(key: string) {
  return parseISO(key)
}

export type Urgency = 'urgent' | 'soon' | 'later' | 'done'

export function getUrgency(dueAt: string, completed = false): Urgency {
  if (completed) return 'done'
  const due = parseISO(dueAt)
  const hours = (due.getTime() - Date.now()) / 36e5
  if (hours <= 24) return 'urgent'
  if (hours <= 72) return 'soon'
  return 'later'
}

export const urgencyStyles: Record<Urgency, { dot: string; badge: string; label: string }> = {
  urgent: {
    dot: 'bg-urgent',
    badge: 'bg-urgent/12 text-urgent border-urgent/25',
    label: 'Urgent',
  },
  soon: {
    dot: 'bg-soon',
    badge: 'bg-soon/15 text-foreground border-soon/40',
    label: 'Soon',
  },
  later: {
    dot: 'bg-later',
    badge: 'bg-later/12 text-later border-later/25',
    label: 'Later',
  },
  done: {
    dot: 'bg-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
    label: 'Done',
  },
}

export function formatDue(dueAt: string) {
  const due = parseISO(dueAt)
  const time = format(due, 'h:mm a')
  if (isPast(due) && !isToday(due)) {
    const days = differenceInCalendarDays(new Date(), due)
    return `Overdue by ${days} day${days === 1 ? '' : 's'}`
  }
  if (isToday(due)) return isPast(due) ? `Overdue · today ${time}` : `Today, ${time}`
  if (isTomorrow(due)) return `Tomorrow, ${time}`
  return format(due, "EEE, MMM d 'at' h:mm a")
}

export function isOverdue(dueAt: string) {
  return isPast(parseISO(dueAt))
}

export function isThisWeek(dateIso: string) {
  const now = new Date()
  return isWithinInterval(parseISO(dateIso), {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  })
}

export function isDueToday(dueAt: string) {
  return isToday(parseISO(dueAt))
}

export function daysUntil(dateKey: string) {
  return differenceInCalendarDays(parseISO(dateKey), startOfDay(new Date()))
}

export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return format(d, 'h:mm a')
}
