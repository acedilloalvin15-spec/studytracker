import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Free study planner for high school and college students
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Never miss a deadline again
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground text-pretty">
            StudyTrack keeps your assignments, class schedule, and exam reviews in one calm place,
            so you always know what to work on next.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={signedIn ? '/dashboard' : '/signup'}
              className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5 text-base')}
            >
              {signedIn ? 'Go to dashboard' : 'Get Started Free'}
              <ArrowRight aria-hidden="true" />
            </Link>
            {!signedIn && (
              <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 px-5 text-base')}>
                Log In
              </Link>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {['No credit card', 'Works on your phone', 'Light & dark mode'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-later" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border shadow-xl">
            <Image
              src="/images/hero-student.png"
              alt="A student planning their week at a desk with a laptop and paper planner"
              width={1200}
              height={900}
              priority
              className="aspect-[4/3] h-auto w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 left-4 w-64 rounded-2xl border bg-card p-4 shadow-lg md:-left-8">
            <p className="text-xs font-medium text-muted-foreground">Due tomorrow</p>
            <p className="mt-1 font-semibold">Biology lab report</p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full bg-urgent" aria-hidden="true" />
              <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">11:59 PM · High priority</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
