'use client'

import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Login and signup show their own logo and theme toggle inside the card.
  const hasOwnHeader = pathname === '/login' || pathname === '/signup'

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-student.png')" }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-indigo-950/80" />
      {!hasOwnHeader && (
        <header className="flex items-center justify-between px-4 py-4 md:px-8">
          <div className="rounded-xl bg-white/95 px-3 py-2 text-slate-900 shadow-sm"><Logo /></div>
          <div className="rounded-full bg-white/90 p-1 text-slate-900"><ThemeToggle /></div>
        </header>
      )}
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 md:items-center md:pt-0">
        <div className="w-full max-w-md [&>div]:shadow-2xl">{children}</div>
      </main>
    </div>
  )
}
