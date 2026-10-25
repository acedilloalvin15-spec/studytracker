import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ReviewerContent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel allows request bodies up to about 4.5 MB, so we stop at 4 MB.
const MAX_BYTES = 4 * 1024 * 1024
const MAX_TEXT_CHARS = 60_000
const HOURLY_LIMIT = 10
const QUESTION_COUNTS = [5, 10, 15]

const quizItem = z.object({
  question: z.string().min(3),
  options: z.array(z.string().min(1)).length(4),
  answer_index: z.number().int().min(0).max(3),
  explanation: z.string().default(''),
})
const aiSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  summary: z.string().min(10),
  key_terms: z.array(z.object({ term: z.string().min(1), definition: z.string().min(1) })).default([]),
  flashcards: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
  quiz: z.array(z.unknown()).default([]),
})

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function buildPrompt(count: number) {
  return `You are a study assistant that turns class material into a reviewer for a student.
Use ONLY the material provided. Do not add facts that are not in it.
Write in the same language as the material (English, Filipino/Tagalog, or a mix).
Keep wording simple and clear for a high school or college student.

Return ONLY valid JSON with exactly this shape:
{
  "title": "short title for the reviewer",
  "summary": "a clear summary of the main ideas, 150 to 300 words, plain text, use \\n\\n between paragraphs",
  "key_terms": [{"term": "...", "definition": "..."}],
  "flashcards": [{"question": "...", "answer": "..."}],
  "quiz": [{"question": "...", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "why the answer is correct"}]
}

Rules:
- key_terms: 8 to 15 items.
- flashcards: 10 to 15 items.
- quiz: exactly ${count} multiple-choice questions. Each has exactly 4 options and one correct answer. answer_index is the position (0 to 3) of the correct option. Spread the correct answers across positions.
- If the material is too short or has no study content, still return the JSON with the best summary you can.`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Please log in first.', 401)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return fail('The reviewer is not set up yet. Add GEMINI_API_KEY to your environment variables.', 501)
  }
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'

  // Simple protection for the free quota: a few reviewers per hour per student.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recent } = await supabase
    .from('reviewers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if ((recent ?? 0) >= HOURLY_LIMIT) {
    return fail('You made many reviewers in the last hour. Please try again a little later.', 429)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Could not read the upload. Please try again.')
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return fail('Please choose a file first.')
  if (file.size > MAX_BYTES) return fail('That file is too big. Please use a file under 4 MB.')

  const count = Number(form.get('count'))
  const questionCount = QUESTION_COUNTS.includes(count) ? count : 10
  const rawTitle = String(form.get('title') ?? '').trim().slice(0, 120)
  const rawSubject = String(form.get('subject_id') ?? '')
  const subjectId = z.uuid().safeParse(rawSubject).success ? rawSubject : null

  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const buffer = Buffer.from(await file.arrayBuffer())

  const parts: Record<string, unknown>[] = [{ text: buildPrompt(questionCount) }]

  try {
    if (ext === 'pdf') {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } })
    } else if (ext === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer })
      if (value.trim().length < 50) return fail('I could not find enough text in that Word file.')
      parts.push({ text: `MATERIAL:\n${value.slice(0, MAX_TEXT_CHARS)}` })
    } else if (ext === 'txt' || ext === 'md') {
      const text = buffer.toString('utf8')
      if (text.trim().length < 50) return fail('That file has too little text to make a reviewer.')
      parts.push({ text: `MATERIAL:\n${text.slice(0, MAX_TEXT_CHARS)}` })
    } else {
      return fail('Please upload a PDF, Word (.docx), or text (.txt) file. For PowerPoint or .doc files, save them as PDF first.')
    }
  } catch {
    return fail('I could not read that file. Try saving it again as a PDF.')
  }

  // Try the main model; if Google is busy, retry once, then fall back to a backup model.
  // Each model has its own free quota, so the backup also helps when the daily limit is reached.
  const models = [model, process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest'].filter(
    (m, i, all) => all.indexOf(m) === i,
  )

  let aiText = ''
  let blocked = false
  let lastStatus = 0

  outer: for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
            promptFeedback?: { blockReason?: string }
          }
          if (data.promptFeedback?.blockReason) {
            blocked = true
            break outer
          }
          const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
          if (text.trim()) {
            aiText = text
            break outer
          }
          lastStatus = 204
          break
        }

        lastStatus = res.status
        console.error(`Gemini error ${res.status} on ${m}:`, (await res.text()).slice(0, 300))
        if (![500, 503, 504].includes(res.status)) break // not a busy error: go to the next model
      } catch (err) {
        lastStatus = 0
        console.error(`Gemini request failed on ${m}:`, err)
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  if (blocked) return fail('The AI could not use that file. Try a different one.', 422)
  if (!aiText) {
    if (lastStatus === 429) {
      return fail('The free AI limit was reached for now. Please wait a few minutes (or until tomorrow) and try again.', 429)
    }
    if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403 || lastStatus === 404) {
      return fail('The AI service rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL in your Vercel settings.', 502)
    }
    return fail('The AI service is busy right now. Please try again in a minute.', 503)
  }

  let content: ReviewerContent
  let aiTitle: string | undefined
  try {
    const cleaned = aiText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = aiSchema.parse(JSON.parse(cleaned))
    const quiz = parsed.quiz.flatMap((q) => {
      const r = quizItem.safeParse(q)
      return r.success ? [r.data] : []
    })
    if (!parsed.key_terms.length && !parsed.flashcards.length && !quiz.length) throw new Error('empty')
    content = { summary: parsed.summary, key_terms: parsed.key_terms, flashcards: parsed.flashcards, quiz }
    aiTitle = parsed.title
  } catch {
    return fail('The AI answer came back in a wrong format. Please press Generate again.', 502)
  }

  const title = rawTitle || aiTitle || name.replace(/\.[^.]+$/, '')
  const { data: saved, error } = await supabase
    .from('reviewers')
    .insert({ title, source_name: name, subject_id: subjectId, content })
    .select('id')
    .single()
  if (error || !saved) {
    return fail('The reviewer was made but could not be saved. Did you run supabase/reviewers.sql in Supabase?', 500)
  }

  return NextResponse.json({ id: saved.id })
}
