import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how-it-works" className="hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'px-4')}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'px-3')}>
                Log in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'px-4')}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
