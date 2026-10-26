import Link from 'next/link'
import type { ReactNode } from 'react'
import { BookOpen, CalendarCheck } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Shared split card for the login and signup pages.
 * Left: logo, the form (children) and a footer line. Right: photo with floating cards.
 * The theme toggle sits in the card's top-right corner.
 */
export function AuthSplitCard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    // The left/-translate trick centers the wide card even if the page wraps it in a narrow container.
    <div className="relative left-1/2 grid w-[min(62rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 shadow-2xl backdrop-blur md:grid-cols-2">
      <div className="absolute top-4 right-4 z-10 rounded-full bg-background/80 shadow-md backdrop-blur [&_button]:rounded-full">
        <ThemeToggle />
      </div>

      {/* Left: logo, form, footer */}
      <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-8 sm:px-12">
        <Logo className="self-start" />
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">{children}</div>
        <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>{footer}</div>
          <p className="flex gap-3">
            <Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link>
          </p>
        </div>
      </div>

      {/* Right: photo with floating study cards (hidden on small screens) */}
      <div className="relative hidden min-h-[34rem] p-3 md:block" aria-hidden="true">
        <div className="relative size-full overflow-hidden rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero-student.png" alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

          <div className="absolute top-5 left-5 flex items-center gap-3 rounded-2xl bg-background/90 px-4 py-3 shadow-lg backdrop-blur">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CalendarCheck className="size-5" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block text-xs text-muted-foreground">Due tomorrow</span>
              <span className="block font-semibold">Biology lab report</span>
              <span className="block text-xs text-muted-foreground">11:59 PM · High priority</span>
            </span>
          </div>

          <div className="absolute right-5 bottom-5 flex items-center gap-3 rounded-2xl bg-background/90 px-4 py-3 shadow-lg backdrop-blur">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <BookOpen className="size-5" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block text-xs text-muted-foreground">Review today</span>
              <span className="block font-semibold">Chemistry · Chapter 4</span>
              <span className="block text-xs text-muted-foreground">45 min session</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
