import Link from 'next/link'
import { Logo } from '@/components/logo'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">
            {'© '}
            {new Date().getFullYear()} StudyTrack. Built for students, by students at heart.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how-it-works" className="hover:text-foreground">How it works</a>
          <Link href="/login" className="hover:text-foreground">Log in</Link>
          <Link href="/signup" className="hover:text-foreground">Sign up</Link>
        </nav>
      </div>
    </footer>
  )
}
