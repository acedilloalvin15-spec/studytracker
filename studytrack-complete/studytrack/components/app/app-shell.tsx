'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/app/notification-bell'
import { UserMenu } from '@/components/app/user-menu'
import { MOBILE_NAV, NAV_ITEMS } from '@/components/app/nav-items'
import { cn } from '@/lib/utils'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mobileItems = NAV_ITEMS.filter((i) => MOBILE_NAV.includes(i.href))
  const activeIndex = mobileItems.findIndex((i) => isActive(pathname, i.href))

  return (
    <div className="flex min-h-dvh bg-muted/40">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <Logo href="/dashboard" className="px-2" />
        <nav aria-label="App" className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  active && 'bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/15 hover:text-sidebar-primary',
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <p className="mt-auto rounded-xl bg-sidebar-accent px-3 py-3 text-xs leading-relaxed text-sidebar-foreground/75">
          Tip: add exams early so the review planner has more days to spread sessions across.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur md:h-16 md:justify-end md:px-8">
          <Logo href="/dashboard" className="md:hidden" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>

      <nav
        aria-label="App"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-md rounded-full border border-white/60 bg-card/80 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl md:hidden dark:border-white/10"
      >
        <div className="relative grid grid-cols-5">
          {/* The highlight slides to the tab you open. */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 left-0 w-1/5 rounded-full bg-foreground/10 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] motion-reduce:transition-none',
              activeIndex < 0 && 'opacity-0',
            )}
            style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
          />
          {mobileItems.map(({ href, label, icon: Icon }, i) => {
            const active = i === activeIndex
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-medium text-muted-foreground transition-colors duration-200 motion-reduce:transition-none',
                  active && 'font-bold text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
