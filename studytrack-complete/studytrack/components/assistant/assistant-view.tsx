'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Check, Copy, GraduationCap, Lightbulb, ListChecks, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  feedback?: number | null
}

type ReviewerOption = { id: string; title: string }

const CARDS = [
  { text: 'Explain photosynthesis in simple words', className: 'from-violet-500 to-fuchsia-500' },
  { text: 'Make me a study plan for this week', className: 'from-sky-500 to-blue-600' },
]

const ROWS = [
  { text: 'Quiz me on my reviewer', icon: GraduationCap },
  { text: 'How do I add an exam?', icon: ListChecks },
  { text: 'Give me study tips', icon: Lightbulb },
  { text: 'What is the Pythagorean theorem?', icon: Sparkles },
]

function Typing() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  )
}

export function AssistantView({
  initialMessages,
  reviewers,
}: {
  initialMessages: AssistantMessage[]
  reviewers: ReviewerOption[]
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return

    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: message }])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, reviewerId: reviewerId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setInput(message)
        toast.error(data.error ?? 'The assistant could not answer. Please try again.')
        return
      }
      setMessages((prev) => [
        ...prev.map((m) => (m.id === tempId ? { ...m, id: `saved-${tempId}` } : m)),
        data.reply ?? { id: `reply-${Date.now()}`, role: 'assistant', content: '' },
      ])
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInput(message)
      toast.error('No internet connection. Please try again when you are back online.')
    } finally {
      setSending(false)
    }
  }

  async function rate(id: string, value: 1 | -1) {
    const previous = messages.find((m) => m.id === id)?.feedback ?? null
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: value } : m)))
    try {
      const res = await fetch('/api/assistant/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, feedback: value }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: previous } : m)))
      toast.error('Could not save your feedback. Please try again.')
    }
  }

  async function copy(m: AssistantMessage) {
    try {
      await navigator.clipboard.writeText(m.content)
      setCopiedId(m.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error('Could not copy. Please select the text instead.')
    }
  }

  async function clearChat() {
    if (!window.confirm('Clear the whole chat? This cannot be undone.')) return
    const res = await fetch('/api/assistant/chat', { method: 'DELETE' })
    if (res.ok) {
      setMessages([])
      toast.success('Chat cleared.')
    } else {
      toast.error('Could not clear the chat. Please try again.')
    }
  }

  const canSend = input.trim().length > 0 && !sending

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <Link href="/dashboard" aria-label="Back" className="flex size-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-1.5 font-semibold">
          Study Buddie
          <span className="flex size-5 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white" aria-hidden="true">✓</span>
        </div>
        <button
          type="button"
          onClick={clearChat}
          aria-label="Clear chat"
          disabled={messages.length === 0}
          className="flex size-10 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
        >
          <Trash2 className="size-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 pt-6">
              <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 text-white shadow-lg">
                <Sparkles className="size-8" />
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                {CARDS.map((c) => (
                  <button
                    key={c.text}
                    type="button"
                    onClick={() => send(c.text)}
                    disabled={sending}
                    className={cn(
                      'flex h-36 items-end rounded-2xl bg-gradient-to-br p-3 text-left text-sm font-medium text-white shadow-md transition hover:brightness-110 disabled:opacity-60',
                      c.className,
                    )}
                  >
                    {c.text}
                  </button>
                ))}
              </div>
              <div className="flex w-full flex-col gap-2">
                {ROWS.map((r) => (
                  <button
                    key={r.text}
                    type="button"
                    onClick={() => send(r.text)}
                    disabled={sending}
                    className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left text-sm font-medium transition hover:bg-muted disabled:opacity-60"
                  >
                    <r.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {r.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="flex min-w-0 max-w-[85%] flex-col gap-1">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  {m.content && (
                    <div className="flex gap-1 text-muted-foreground">
                      <button type="button" aria-label="Copy" onClick={() => copy(m)} className="rounded-full p-1.5 hover:bg-muted">
                        {copiedId === m.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </button>
                      {!m.id.startsWith('temp-') && !m.id.startsWith('reply-') && (
                        <>
                          <button
                            type="button"
                            aria-label="Helpful"
                            aria-pressed={m.feedback === 1}
                            onClick={() => rate(m.id, 1)}
                            className={cn('rounded-full p-1.5 hover:bg-muted', m.feedback === 1 && 'text-primary')}
                          >
                            <ThumbsUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Not helpful"
                            aria-pressed={m.feedback === -1}
                            onClick={() => rate(m.id, -1)}
                            className={cn('rounded-full p-1.5 hover:bg-muted', m.feedback === -1 && 'text-destructive')}
                          >
                            <ThumbsDown className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                <Sparkles className="size-3.5" />
              </div>
              <Typing />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t bg-background px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {reviewers.length > 0 && (
            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              Reviewer:
              <select
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                className="max-w-[60%] rounded-full border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="">None</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <form
            className="flex items-center gap-2 rounded-full border bg-muted/50 py-1.5 pr-1.5 pl-4"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              maxLength={1000}
              disabled={sending}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white disabled:opacity-50"
            >
              {canSend ? <ArrowUp className="size-4" /> : <Sparkles className="size-4" />}
            </button>
          </form>
          <p className="px-2 text-center text-[11px] text-muted-foreground">
            Answers can be wrong. Check important details with your notes or teacher.
          </p>
        </div>
      </footer>
    </div>
  )
}
