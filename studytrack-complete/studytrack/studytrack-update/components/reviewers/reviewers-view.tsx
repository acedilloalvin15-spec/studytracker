'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/form-field'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState, PageHeader, SubjectTag } from '@/components/app/shared'
import { SelectField } from '@/components/app/select-field'
import { useReviewers, useSubjectMap, useSubjects } from '@/hooks/use-study-data'
import { createClient } from '@/lib/supabase/client'
import type { Reviewer } from '@/lib/types'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['pdf', 'docx', 'txt', 'md']

export function ReviewersView() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: reviewers, isLoading } = useReviewers()
  const { data: subjectList } = useSubjects()
  const subjects = useSubjectMap()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('none')
  const [count, setCount] = useState('10')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Reviewer | null>(null)

  function pick(f: File | null | undefined) {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED.includes(ext)) {
      toast.error('Please choose a PDF, Word (.docx), or text (.txt) file.')
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error('That file is over 4 MB. Please use a smaller file.')
      return
    }
    setFile(f)
  }

  async function generate() {
    if (!file) {
      toast.error('Choose a file first.')
      return
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('title', title)
      body.append('count', count)
      if (subjectId !== 'none') body.append('subject_id', subjectId)
      const res = await fetch('/api/reviewer/generate', { method: 'POST', body })
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
      if (!res.ok || !data?.id) {
        toast.error(data?.error ?? 'Could not make the reviewer. Please try again.')
        return
      }
      toast.success('Your reviewer is ready!')
      await mutate('reviewers')
      router.push(`/reviewers/${data.id}`)
    } catch {
      toast.error('Something went wrong. Check your internet and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const { error } = await createClient().from('reviewers').delete().eq('id', deleting.id)
    if (error) {
      toast.error('Could not delete the reviewer.')
      return
    }
    toast.success('Reviewer deleted')
    await mutate('reviewers')
  }

  return (
    <>
      <PageHeader
        title="Reviewer maker"
        description="Upload your lesson, handout, or notes and get a summary, key terms, flashcards, and a practice quiz."
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Make a new reviewer</CardTitle>
          <CardDescription>PDF, Word (.docx), or text files up to 4 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            aria-label="Choose a file"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pick(e.dataTransfer.files?.[0])
            }}
            disabled={busy}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-muted/40 px-6 py-10 text-center transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <UploadCloud className="size-8 text-primary" aria-hidden="true" />
            {file ? (
              <>
                <span className="font-medium break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB. Tap to choose a different file.</span>
              </>
            ) : (
              <>
                <span className="font-medium">Tap to choose a file, or drop it here</span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT</span>
              </>
            )}
          </button>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="rv_title" label="Title (optional)">
              <Input id="rv_title" className="h-10" placeholder="e.g. Cell Biology, Chapter 3" value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField id="rv_subject" label="Subject (optional)">
              <SelectField
                id="rv_subject"
                value={subjectId}
                onChange={setSubjectId}
                options={[{ value: 'none', label: 'No subject' }, ...(subjectList ?? []).map((s) => ({ value: s.id, label: s.name, color: s.color }))]}
              />
            </FormField>
            <FormField id="rv_count" label="Quiz questions">
              <SelectField
                id="rv_count"
                value={count}
                onChange={setCount}
                options={[
                  { value: '5', label: '5 questions' },
                  { value: '10', label: '10 questions' },
                  { value: '15', label: '15 questions' },
                ]}
              />
            </FormField>
          </div>

          <p className="text-xs text-muted-foreground text-pretty">
            Your file is sent to Google&apos;s Gemini AI to make the reviewer. Please don&apos;t upload private or sensitive documents.
          </p>

          <Button size="lg" className="self-start" onClick={generate} disabled={busy || !file}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {busy ? 'Reading your file…' : 'Generate reviewer'}
          </Button>
          {busy && <p role="status" className="text-sm text-muted-foreground">This can take up to a minute. Please keep this page open.</p>}
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Your reviewers</h2>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !reviewers?.length ? (
        <EmptyState icon={FileText} title="No reviewers yet" description="Upload your first file above and your reviewer will be saved here." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reviewers.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-2xl border bg-card p-4">
              <Link href={`/reviewers/${r.id}`} className="min-w-0 flex-1 focus-visible:underline">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {r.source_name ? `${r.source_name} · ` : ''}
                  {format(parseISO(r.created_at), 'MMM d, yyyy')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.subject_id && <SubjectTag subject={subjects.get(r.subject_id)} />}
                  <span>{r.content.flashcards.length} flashcards</span>
                  <span>{r.content.quiz.length} quiz questions</span>
                </div>
              </Link>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.title}`} onClick={() => setDeleting(r)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this reviewer?"
        description={`"${deleting?.title ?? ''}" will be permanently removed.`}
        onConfirm={confirmDelete}
      />
    </>
  )
}
