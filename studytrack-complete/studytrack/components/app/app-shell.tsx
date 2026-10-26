'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/app/notification-bell'
import { UserMenu } from '@/components/app/user-menu'
import { MOBILE_NAV, NAV_ITEMS } from '@/components/app/nav-items'
import { ACTIONS_SLOT_ID, TITLE_SLOT_ID } from '@/components/app/header-slots'
import { cn } from '@/lib/utils'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-violet-100 via-indigo-50 to-violet-200 md:gap-4 md:p-4 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-900">
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-60 shrink-0 flex-col rounded-3xl bg-white/70 px-3 py-5 shadow-sm backdrop-blur-xl md:flex dark:bg-white/5">
        <Logo href="/dashboard" className="px-3" />
        <nav aria-label="App" className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-foreground/65 transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10',
                  active && 'bg-white text-foreground shadow-sm hover:bg-white dark:bg-white/15 dark:hover:bg-white/15',
                )}
              >
                <Icon className={cn('size-4.5', active && 'text-primary')} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <p className="mt-auto rounded-2xl bg-white/60 px-4 py-3 text-xs leading-relaxed text-foreground/65 dark:bg-white/10">
          Tip: add exams early so the review planner has more days to spread sessions across.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:gap-4">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-white/70 px-4 backdrop-blur-xl md:top-4 md:h-16 md:rounded-full md:px-6 md:shadow-sm dark:bg-white/5">
          <Logo href="/dashboard" className="md:hidden" />
          <div id={TITLE_SLOT_ID} className="hidden min-w-0 flex-1 md:block" />
          <div id={ACTIONS_SLOT_ID} className="hidden shrink-0 items-center md:flex" />
          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-2 md:pt-2 md:pb-8">{children}</main>
      </div>

      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(99,102,241,0.12)] backdrop-blur-xl md:hidden dark:bg-slate-950/85"
      >
        {NAV_ITEMS.filter((i) => MOBILE_NAV.includes(i.href)).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground',
                active && 'text-primary',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
