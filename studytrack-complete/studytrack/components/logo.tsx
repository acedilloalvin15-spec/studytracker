import Link from 'next/link'
import { BookOpenCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpenCheck className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-lg">StudyTrack</span>
    </Link>
  )
}
