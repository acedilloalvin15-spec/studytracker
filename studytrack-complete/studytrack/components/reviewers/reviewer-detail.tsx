'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileText, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState, PageHeader, SubjectTag } from '@/components/app/shared'
import { useReviewer, useSubjectMap } from '@/hooks/use-study-data'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { ReviewerContent } from '@/lib/types'

export function ReviewerDetail({ id }: { id: string }) {
  const router = useRouter()
  const { data: reviewer, isLoading } = useReviewer(id)
  const subjects = useSubjectMap()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  if (!reviewer) {
    return (
      <EmptyState
        icon={FileText}
        title="Reviewer not found"
        description="It may have been deleted. Go back and make a new one."
        action={
          <Link href="/reviewers" className={buttonVariants()}>
            Back to Reviewer maker
          </Link>
        }
      />
    )
  }

  const c = reviewer.content

  async function remove() {
    const { error } = await createClient().from('reviewers').delete().eq('id', id)
    if (error) {
      toast.error('Could not delete the reviewer.')
      return
    }
    toast.success('Reviewer deleted')
    await mutate('reviewers')
    router.replace('/reviewers')
  }

  return (
    <>
      <Link href="/reviewers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All reviewers
      </Link>
      <PageHeader
        title={reviewer.title}
        description={`${reviewer.source_name ? `${reviewer.source_name} · ` : ''}${format(parseISO(reviewer.created_at), 'MMM d, yyyy')}`}
        actions={
          <>
            {reviewer.subject_id && <SubjectTag subject={subjects.get(reviewer.subject_id)} />}
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <Trash2 aria-hidden="true" /> Delete
            </Button>
          </>
        }
      />

      <Tabs defaultValue="summary" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="terms">Key terms ({c.key_terms.length})</TabsTrigger>
          <TabsTrigger value="cards">Flashcards ({c.flashcards.length})</TabsTrigger>
          <TabsTrigger value="quiz">Quiz ({c.quiz.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col gap-4 leading-relaxed">
              {c.summary.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="text-pretty">{p}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          {c.key_terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No key terms were made for this file.</p>
          ) : (
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {c.key_terms.map((t, i) => (
                <div key={i} className="rounded-2xl border bg-card p-4">
                  <dt className="font-semibold text-primary">{t.term}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground text-pretty">{t.definition}</dd>
                </div>
              ))}
            </dl>
          )}
        </TabsContent>

        <TabsContent value="cards" className="flex flex-col gap-4">
          <RegenerateControls reviewerId={id} kind="flashcards" />
          <Flashcards key={c.flashcards[0]?.question} cards={c.flashcards} />
        </TabsContent>

        <TabsContent value="quiz" className="flex flex-col gap-4">
          <RegenerateControls reviewerId={id} kind="quiz" />
          <Quiz key={c.quiz[0]?.question} items={c.quiz} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this reviewer?"
        description="It will be permanently removed."
        onConfirm={remove}
      />
    </>
  )
}

function RegenerateControls({ reviewerId, kind }: { reviewerId: string; kind: 'flashcards' | 'quiz' }) {
  const [style, setStyle] = useState('fresh')
  const [loading, setLoading] = useState(false)
  const label = kind === 'quiz' ? 'quiz' : 'flashcards'

  async function regenerate() {
    if (!window.confirm(`Replace your current ${label} with a new set?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reviewers/${reviewerId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, style }),
      })
      if (!res.ok) throw new Error()
      // Reload this reviewer (works whatever key the data hook uses)
      await mutate((key) =>
        Array.isArray(key) ? key.includes(reviewerId) : typeof key === 'string' && key.includes(reviewerId),
      )
      toast.success(`New ${label} ready`)
    } catch {
      toast.error('Could not make a new set. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        disabled={loading}
        aria-label="Style of the new set"
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="fresh">Fresh angle</option>
        <option value="easier">Easier</option>
        <option value="harder">Harder</option>
      </select>
      <Button variant="outline" onClick={regenerate} disabled={loading}>
        <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        {loading ? 'Making a new set...' : `New ${label}`}
      </Button>
    </div>
  )
}

function Flashcards({ cards }: { cards: ReviewerContent['flashcards'] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards.length) return <p className="text-sm text-muted-foreground">No flashcards were made for this file.</p>
  const card = cards[index]

  function go(delta: number) {
    setFlipped(false)
    setIndex((i) => (i + delta + cards.length) % cards.length)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Showing the answer. Tap to show the question.' : 'Showing the question. Tap to show the answer.'}
        className={cn(
          'flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-8 text-center shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          flipped && 'border-primary bg-primary/5',
        )}
      >
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{flipped ? 'Answer' : 'Question'}</span>
        <span className="text-lg font-medium text-balance">{flipped ? card.answer : card.question}</span>
        <span className="text-xs text-muted-foreground">Tap the card to flip it</span>
      </button>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => go(-1)} aria-label="Previous card">
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {index + 1} of {cards.length}
        </span>
        <Button variant="outline" onClick={() => go(1)} aria-label="Next card">
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

function Quiz({ items }: { items: ReviewerContent['quiz'] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})

  if (!items.length) return <p className="text-sm text-muted-foreground">No quiz questions were made for this file.</p>

  const answered = Object.keys(answers).length
  const score = items.reduce((n, q, i) => n + (answers[i] === q.answer_index ? 1 : 0), 0)
  const done = answered === items.length

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {items.map((q, i) => {
        const picked = answers[i]
        const hasPicked = picked !== undefined
        return (
          <Card key={i} className="rounded-2xl">
            <CardContent className="flex flex-col gap-3">
              <p className="font-medium text-pretty">
                {i + 1}. {q.question}
              </p>
              <ul className="flex flex-col gap-2">
                {q.options.map((opt, o) => {
                  const isCorrect = o === q.answer_index
                  const isPicked = picked === o
                  return (
                    <li key={o}>
                      <button
                        type="button"
                        disabled={hasPicked}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: o }))}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                          !hasPicked && 'hover:bg-muted',
                          hasPicked && isCorrect && 'border-later bg-later/10',
                          hasPicked && isPicked && !isCorrect && 'border-urgent bg-urgent/10',
                        )}
                      >
                        <span className="font-semibold">{String.fromCharCode(65 + o)}.</span>
                        <span className="flex-1">{opt}</span>
                        {hasPicked && isCorrect && <CheckCircle2 className="size-4 shrink-0 text-later" aria-label="Correct answer" />}
                        {hasPicked && isPicked && !isCorrect && <XCircle className="size-4 shrink-0 text-urgent" aria-label="Your wrong answer" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {hasPicked && q.explanation && (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground text-pretty">{q.explanation}</p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4" role="status">
        <p className="font-medium">
          {done ? `Your score: ${score} of ${items.length}` : `Answered ${answered} of ${items.length}`}
        </p>
        <Button variant="outline" onClick={() => setAnswers({})} disabled={answered === 0}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      </div>
    </div>
  )
}
