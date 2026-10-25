import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 md:items-center md:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
