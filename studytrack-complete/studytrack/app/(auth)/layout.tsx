'use client'

import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Login and signup show their own logo and theme toggle inside the card.
  const hasOwnHeader = pathname === '/login' || pathname === '/signup'

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-violet-100 via-indigo-50 to-violet-200 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-900">
      {!hasOwnHeader && (
        <header className="flex items-center justify-between px-4 py-4 md:px-8">
          <div className="rounded-full bg-white/70 px-4 py-2 text-foreground shadow-sm backdrop-blur-xl dark:bg-white/10"><Logo /></div>
          <div className="rounded-full bg-white/70 p-1 text-foreground shadow-sm backdrop-blur-xl dark:bg-white/10"><ThemeToggle /></div>
        </header>
      )}
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 md:items-center md:pt-0">
        <div className="w-full max-w-md [&>div]:shadow-2xl">{children}</div>
      </main>
    </div>
  )
}
