import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    title: 'Add your subjects',
    body: 'Create each class with your teacher’s name and a color you’ll recognize at a glance.',
  },
  {
    title: 'Enter deadlines and classes',
    body: 'Drop in assignments as they’re announced and set up your weekly timetable in a few taps.',
  },
  {
    title: 'Follow your daily plan',
    body: 'Open your dashboard each day to see what’s due, which classes you have, and what to review.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:p-10">
          <div>
            <p className="text-2xl font-bold text-balance">Ready for a calmer semester?</p>
            <p className="mt-1 opacity-85">Set up StudyTrack in under five minutes.</p>
          </div>
          <Link href="/signup" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'h-11 px-5 text-base')}>
            Get Started Free
          </Link>
        </div>
      </div>
    </section>
  )
}
