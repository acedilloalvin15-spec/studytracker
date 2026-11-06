import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AshnaError, ashnaConfigured, callAshna, type AshnaResult } from '@/lib/ashna'
import { extractTextFromFile } from '@/lib/reviewer-extract'
import { generateReviewer, ReviewerError, type GeneratedReviewer } from '@/lib/reviewer-generator'
import type { ReviewerContent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel allows request bodies up to about 4.5 MB, so we stop at 4 MB.
const MAX_BYTES = 4 * 1024 * 1024
const QUESTION_COUNTS = [5, 10, 15]
const MIN_CHARS = 150
// Protects the AI quota: after this many reviewers in an hour, the simple rules are used instead.
const AI_PER_HOUR = 10

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function mergeContent(ai: AshnaResult, rules: GeneratedReviewer | null): ReviewerContent {
  return {
    engine: 'ashna',
    summary: ai.summary ?? rules?.content.summary ?? '',
    key_terms: ai.key_terms.length ? ai.key_terms : (rules?.content.key_terms ?? []),
    flashcards: ai.flashcards.length >= 3 ? ai.flashcards : (rules?.content.flashcards ?? ai.flashcards),
    quiz: ai.quiz.length >= 3 ? ai.quiz : (rules?.content.quiz ?? ai.quiz),
  }
}

// Makes a reviewer from a PDF/Word/text file or pasted text. Ashna AI writes it when it is available;
// otherwise (or if it fails) simple rules do. The original file is never stored.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Please log in first.', 401)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Could not read the upload. Please try again.')
  }

  const count = Number(form.get('count'))
  const questionCount = QUESTION_COUNTS.includes(count) ? count : 10

  let text = ''
  let sourceName = 'Pasted text'
  let fallbackTitle = 'My notes'

  const file = form.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return fail('That file is too big. Please use a file under 4 MB.')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      return fail('Please upload a PDF, Word (.docx), or text (.txt) file. For PowerPoint or .doc files, save them as PDF first.')
    }
    try {
      text = await extractTextFromFile(new Uint8Array(await file.arrayBuffer()), ext)
    } catch {
      return fail('I could not read that file. Try saving it again as a PDF or Word file.')
    }
    sourceName = file.name
    fallbackTitle = file.name.replace(/\.[^.]+$/, '')
  } else {
    const pasted = form.get('text')
    if (typeof pasted !== 'string' || !pasted.trim()) return fail('Please choose a file or paste some text first.')
    text = pasted.slice(0, 250_000)
  }

  if (!text.trim()) {
    return fail(
      'No readable text was found. If this PDF is a scan or a photo of a page, it cannot be read. Use a PDF with selectable text, or paste the text instead.',
      422,
    )
  }
  if (text.replace(/\s+/g, ' ').trim().length < MIN_CHARS) {
    return fail('There is too little text to make a reviewer. Try a longer lesson or notes.', 422)
  }

  // The simple-rules reviewer is always prepared: it is the backup and fills any gaps.
  let rules: GeneratedReviewer | null = null
  try {
    rules = generateReviewer(text, { questionCount, fallbackTitle })
  } catch (err) {
    if (!(err instanceof ReviewerError)) return fail('Something went wrong while making the reviewer. Please try again.', 500)
  }

  let ai: AshnaResult | null = null
  let aiError: string | undefined
  if (ashnaConfigured()) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recent } = await supabase.from('reviewers').select('id', { count: 'exact', head: true }).gte('created_at', since)
    if ((recent ?? 0) >= AI_PER_HOUR) {
      aiError = 'hourly_limit'
    } else {
      try {
        ai = await callAshna(text, questionCount)
      } catch (err) {
        aiError = err instanceof AshnaError ? err.code : 'unknown'
        console.error('Ashna AI was not used:', aiError)
      }
    }
  } else {
    aiError = 'not_configured'
  }

  if (ai) {
    const title = ai.title || rules?.title || fallbackTitle
    return NextResponse.json({ title, content: mergeContent(ai, rules), source_name: sourceName, engine: 'ashna' })
  }
  if (!rules) return fail('There is too little text to make a reviewer. Try a longer lesson or notes.', 422)
  return NextResponse.json({
    title: rules.title,
    content: { ...rules.content, engine: 'rules' },
    source_name: sourceName,
    engine: 'rules',
    ai_error: aiError,
  })
}
