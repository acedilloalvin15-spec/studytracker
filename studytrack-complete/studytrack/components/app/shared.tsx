import type { LucideIcon } from 'lucide-react'
import { HeaderContent } from '@/components/app/header-slots'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Subject } from '@/lib/types'

/**
 * Page title, description and buttons.
 * On desktop they appear inside the top bar (see header-slots.tsx); on phones they stay at the top of the page.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return <HeaderContent title={title} description={description} actions={actions} />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/70 px-6 py-12 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function SubjectDot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color ?? 'var(--muted-foreground)' }}
      aria-hidden="true"
    />
  )
}

export function SubjectTag({ subject }: { subject?: Subject }) {
  if (!subject) return <span className="text-xs text-muted-foreground">No subject</span>
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: `${subject.color}55`, backgroundColor: `${subject.color}14` }}
    >
      <SubjectDot color={subject.color} className="size-2" />
      {subject.name}
    </span>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  )
}
