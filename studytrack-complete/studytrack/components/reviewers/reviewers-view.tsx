'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ClipboardPaste, FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
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
import { ReviewerDetail } from '@/components/reviewers/reviewer-detail'
import { useReviewers, useSubjectMap, useSubjects } from '@/hooks/use-study-data'
import { newId } from '@/lib/offline-queue'
import { generateReviewer, ReviewerError, type GeneratedReviewer } from '@/lib/reviewer-generator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Reviewer } from '@/lib/types'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['pdf', 'docx', 'txt', 'md']

/** The Reviewer page: the list and maker, or one reviewer when the address has ?id=... */
export function ReviewersView() {
  const id = useSearchParams().get('id')
  return id ? <ReviewerDetail id={id} /> : <ReviewersHome />
}

function ReviewersHome() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: reviewers, isLoading } = useReviewers()
  const { data: subjectList } = useSubjects()
  const subjects = useSubjectMap()
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState('')
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

  type Made = GeneratedReviewer & { source_name: string; engine?: 'ashna' | 'rules'; ai_error?: string }

  // Reads the material on the phone with the simple rules (works without internet).
  async function buildOnDevice(questionCount: number): Promise<Made> {
    const text = mode === 'text' ? pasted : await file!.text()
    const fallbackTitle = mode === 'text' ? 'My notes' : file!.name.replace(/\.[^.]+$/, '')
    const result = generateReviewer(text, { questionCount, fallbackTitle })
    return {
      ...result,
      content: { ...result.content, engine: 'rules' },
      source_name: mode === 'text' ? 'Pasted text' : file!.name,
      engine: 'rules',
    }
  }

  async function build(): Promise<Made | null> {
    const questionCount = Number(count)
    if (mode === 'file' && !file) {
      toast.error('Choose a file first.')
      return null
    }
    const ext = file?.name.split('.').pop()?.toLowerCase() ?? ''
    const needsServer = mode === 'file' && (ext === 'pdf' || ext === 'docx')

    if (!navigator.onLine) {
      if (needsServer) {
        toast.error('PDF and Word files need internet to be read. Paste the text, or use a .txt file, to work offline.')
        return null
      }
      return buildOnDevice(questionCount)
    }

    const body = new FormData()
    body.append('count', String(questionCount))
    if (mode === 'text') body.append('text', pasted)
    else body.append('file', file!)

    let res: Response
    try {
      res = await fetch('/api/reviewer/generate', { method: 'POST', body })
    } catch {
      // The connection dropped: text can still be read on the phone.
      if (needsServer) {
        toast.error('The connection dropped. Please try again.')
        return null
      }
      return buildOnDevice(questionCount)
    }
    const data = (await res.json().catch(() => null)) as (Made & { error?: string }) | null
    if (!res.ok || !data || data.error) {
      toast.error(data?.error || 'Could not make the reviewer. Please try again.')
      return null
    }
    return data
  }

  async function generate() {
    setBusy(true)
    try {
      const made = await build()
      if (!made) return

      const row = {
        id: newId(),
        title: title.trim() || made.title,
        source_name: made.source_name,
        subject_id: subjectId === 'none' ? null : subjectId,
        content: made.content,
      }
      const { error } = await createClient().from('reviewers').insert(row)
      if (error) {
        toast.error('The reviewer was made but could not be saved. Did you run supabase/reviewers.sql in Supabase?')
        return
      }
      const withDate: Reviewer = { ...row, created_at: new Date().toISOString() }
      await mutate('reviewers', (current?: Reviewer[]) => [withDate, ...(current ?? [])], { revalidate: navigator.onLine })
      if (!navigator.onLine) toast.success('Your reviewer is ready and saved on this phone.')
      else if (made.engine === 'ashna') toast.success('Your reviewer is ready! Written with Ashna AI.')
      else {
        toast.success('Your reviewer is ready!')
        if (made.ai_error && made.ai_error !== 'not_configured') {
          toast.message('Ashna AI was not available just now, so simple rules were used.')
        }
      }
      router.push(`/reviewers?id=${row.id}`)
    } catch (err) {
      if (err instanceof ReviewerError) {
        toast.error(
          err.code === 'too_short'
            ? 'There is too little text to make a reviewer. Try a longer lesson or notes.'
            : 'No readable text was found.',
        )
      } else {
        toast.error('Something went wrong. Please try again.')
      }
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

  const ready = mode === 'file' ? !!file : pasted.trim().length > 0

  return (
    <>
      <PageHeader
        title="Reviewer maker"
        description="Give it your lesson, handout, or notes and get a summary, key terms, flashcards, and a practice quiz."
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Make a new reviewer</CardTitle>
          <CardDescription>
            Online, Ashna AI writes your reviewer. Offline, or if Ashna AI is busy, simple rules find the headings, definitions,
            and key sentences instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div role="group" aria-label="How to add your material" className="flex w-fit gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ['file', 'Upload a file', UploadCloud],
                ['text', 'Paste text', ClipboardPaste],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  mode === value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <>
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
                    <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT, up to 4 MB</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <FormField id="rv_text" label="Your notes">
              <textarea
                id="rv_text"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder="Paste your lesson or notes here. Short headings and lines like “Term: meaning” make a better reviewer."
                className="min-h-40 w-full rounded-xl border bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            When you are online, the text of your material is sent to Ashna AI to write the reviewer, so please don&apos;t use private
            documents. Offline, pasted text and .txt files are read on your phone with simple rules. PDF and Word files always need
            internet, and we don&apos;t keep the file. Pictures and scanned pages can&apos;t be read.
          </p>

          <Button size="lg" className="self-start" onClick={generate} disabled={busy || !ready}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {busy ? 'Making your reviewer…' : 'Make reviewer'}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Your reviewers</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !reviewers?.length ? (
        <EmptyState icon={FileText} title="No reviewers yet" description="Add your first lesson above and your reviewer will be saved here." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {reviewers.map((r) => (
            <li key={r.id} className="flex min-w-0 items-start justify-between gap-2 rounded-2xl border bg-card p-4">
              <Link href={`/reviewers?id=${r.id}`} className="min-w-0 flex-1 focus-visible:underline">
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
