import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromFile } from '@/lib/reviewer-extract'
import { generateReviewer, ReviewerError } from '@/lib/reviewer-generator'
import { verifyContent } from '@/lib/reviewer-verify'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel allows request bodies up to about 4.5 MB, so we stop at 4 MB.
const MAX_BYTES = 4 * 1024 * 1024
const QUESTION_COUNTS = [5, 10, 15]
const MIN_CHARS = 150

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Makes a reviewer from a PDF/Word/text file or pasted text using simple rules only (no AI).
// The original file is never stored.
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

  let made
  try {
    made = generateReviewer(text, { questionCount, fallbackTitle })
  } catch (err) {
    if (err instanceof ReviewerError) return fail('There is too little text to make a reviewer. Try a longer lesson or notes.', 422)
    return fail('Something went wrong while making the reviewer. Please try again.', 500)
  }

  // Final accuracy check: every answer must be found in the student's own text. Anything else is dropped.
  const checked = verifyContent(made.content, text).content
  return NextResponse.json({
    title: made.title,
    content: { ...checked, summary: checked.summary || made.content.summary, engine: 'rules' },
    source_name: sourceName,
    engine: 'rules',
  })
}
