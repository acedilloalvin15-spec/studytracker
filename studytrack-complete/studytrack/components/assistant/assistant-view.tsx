'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, ThumbsDown, ThumbsUp, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/app/shared'
import { cn } from '@/lib/utils'

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  feedback?: number | null
}

type ReviewerOption = { id: string; title: string }

const STARTERS = [
  'How do I add an exam?',
  'How does the reviewer maker work?',
  'Quiz me on my reviewer',
  'Give me study tips',
]

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
      toast.success('Thanks for your feedback!')
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: previous } : m)))
      toast.error('Could not save your feedback. Please try again.')
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

  const disabled = sending

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Study assistant"
        description="Ask how to use StudyTrack, get study tips, or quiz yourself on a reviewer."
        actions={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clearChat}>
              <Trash2 className="size-4" />
              Clear chat
            </Button>
          ) : null
        }
      />


      <Card className="flex min-h-[60vh] flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3 py-6 text-center">
              <Bot className="mx-auto size-10 text-primary" />
              <p className="text-sm text-muted-foreground">Hi! What would you like help with today?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <Button key={s} variant="outline" size="sm" disabled={disabled} onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div className={cn('flex max-w-[80%] flex-col gap-1', m.role === 'user' && 'items-end')}>
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && !m.id.startsWith('temp-') && !m.id.startsWith('reply-') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Helpful"
                      aria-pressed={m.feedback === 1}
                      onClick={() => rate(m.id, 1)}
                      className={cn(m.feedback === 1 && 'text-primary')}
                    >
                      <ThumbsUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Not helpful"
                      aria-pressed={m.feedback === -1}
                      onClick={() => rate(m.id, -1)}
                      className={cn(m.feedback === -1 && 'text-destructive')}
                    >
                      <ThumbsDown className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && <p className="text-sm text-muted-foreground">The assistant is typing…</p>}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {reviewers.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Help with a reviewer:
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-foreground"
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
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="Ask a question…"
            maxLength={1000}
            rows={2}
            disabled={disabled}
            className="min-h-0 resize-none"
          />
          <Button type="submit" disabled={disabled || !input.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Answers come from StudyTrack's help and your reviewer. Check important details with your notes or teacher.
        </p>
      </div>
    </div>
  )
}
