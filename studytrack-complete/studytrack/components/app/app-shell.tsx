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
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
