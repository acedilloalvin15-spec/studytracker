import { Bell, CalendarClock, ListChecks, Sparkles } from 'lucide-react'

const FEATURES = [
  {
    icon: ListChecks,
    title: 'Deadline Tracker',
    body: 'Log every assignment with a due date, subject, and priority. Color-coded urgency shows what needs attention first.',
  },
  {
    icon: CalendarClock,
    title: 'Weekly Schedule',
    body: 'Build your class timetable once and see exactly where you need to be today, with rooms and times.',
  },
  {
    icon: Sparkles,
    title: 'Smart Review Planner',
    body: 'Add your exam dates and StudyTrack spreads review sessions across the days left, so no subject gets forgotten.',
  },
  {
    icon: Bell,
    title: 'Reminders',
    body: 'Get nudged three days before, the day before, and on the due day. Choose exactly which reminders you want.',
  },
]

export function Features() {
  return (
    <section id="features" className="border-t bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
            Everything a busy student needs, nothing they don&apos;t
          </h2>
          <p className="mt-3 text-muted-foreground text-pretty">
            Four simple tools that work together, so your planner finally keeps up with your semester.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
