// Free, key-less assistant. It answers with rules and text matching, using only:
// the StudyTrack help articles and the reviewer the student chose. No AI service is called.
import { findHelpArticles, type HelpArticle } from '@/lib/assistant/knowledge'
import type { ReviewerContent } from '@/lib/types'

export type ReviewerInput = { title: string; content: ReviewerContent }

const MAX_ARTICLE_CHARS = 700
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'was', 'be', 'i', 'my', 'me', 'it',
  'this', 'that', 'with', 'at', 'from', 'what', 'how', 'do', 'does', 'can', 'please', 'about', 'tell', 'you', 'your',
])

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
}

/** Splits text into sentences and returns the ones that share the most words with the question. */
function bestSentences(text: string, question: string, limit = 3): string[] {
  const qWords = new Set(words(question))
  if (qWords.size === 0) return []
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .map((s) => ({ s, score: words(s).filter((w) => qWords.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function reviewerSummary({ title, content }: ReviewerInput): string {
  return `Summary of "${title}":\n\n${content.summary || 'This reviewer has no summary.'}`
}

function quizQuestion({ content }: ReviewerInput): string {
  if (!content.quiz?.length) return 'This reviewer has no quiz questions.'
  const q = pick(content.quiz)
  const options = q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')
  const correct = `${String.fromCharCode(65 + q.answer_index)}. ${q.options[q.answer_index]}`
  return `${q.question}\n\n${options}\n\nTry it first, then check: Answer: ${correct}${q.explanation ? `\n${q.explanation}` : ''}`
}

function flashcard({ content }: ReviewerInput): string {
  if (!content.flashcards?.length) return 'This reviewer has no flashcards.'
  const f = pick(content.flashcards)
  return `${f.question}\n\nTry to answer first. Answer: ${f.answer}`
}

function findTerm(reviewer: ReviewerInput, question: string) {
  const qWords = words(question)
  return reviewer.content.key_terms?.find((t) => {
    const termWords = words(t.term)
    return termWords.length > 0 && termWords.every((w) => qWords.includes(w))
  })
}

function reviewerAnswer(message: string, reviewer: ReviewerInput): string | null {
  const lower = message.toLowerCase()

  if (/\bsummar(y|ize|ise)\b/.test(lower)) return reviewerSummary(reviewer)
  if (/\bflash ?cards?\b/.test(lower)) return flashcard(reviewer)
  if (/\b(quiz|test me|practice|question me)\b/.test(lower)) return quizQuestion(reviewer)

  const term = findTerm(reviewer, message)
  if (term) return `${term.term}: ${term.definition}`

  const fromText = [
    ...bestSentences(reviewer.content.summary ?? '', message),
    ...(reviewer.content.key_terms ?? []).map((t) => `${t.term}: ${t.definition}`).filter((line) => {
      const qWords = new Set(words(message))
      return words(line).some((w) => qWords.has(w))
    }),
  ].slice(0, 3)

  if (fromText.length) return `From your reviewer "${reviewer.title}":\n\n- ${fromText.join('\n- ')}`
  return null
}

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|kumusta)\b/i
const TIPS = [
  'Study in short blocks of 25 to 45 minutes, then take a 5 minute break.',
  'Test yourself instead of only rereading. Close your notes and try to explain the topic.',
  'Review a little every day. Spacing out study sessions helps you remember more.',
  'Turn key terms into flashcards and go through them until they feel easy.',
  'Start with the hardest topic while your mind is fresh.',
]

export function answerQuestion(message: string, reviewer: ReviewerInput | null): string {
  const text = message.trim()

  if (GREETING.test(text)) {
    return (
      'Hi! I can help you use StudyTrack, give you quick study tips, or quiz you on a reviewer. ' +
      'Pick a reviewer above to ask about its material, or try one of the starter questions.'
    )
  }

  if (reviewer) {
    const fromReviewer = reviewerAnswer(text, reviewer)
    if (fromReviewer) return fromReviewer
  }

  if (/\b(tip|tips|how to study|study better|study habits|advice)\b/i.test(text)) {
    return 'Here are some study tips:\n\n- ' + TIPS.join('\n- ')
  }

  const articles: HelpArticle[] = findHelpArticles(text, 1)
  if (articles.length) {
    const [article] = articles
    const body = article.body.length > MAX_ARTICLE_CHARS ? article.body.slice(0, MAX_ARTICLE_CHARS) + '…' : article.body
    return `${article.title}\n\n${body}`
  }

  if (reviewer) {
    return (
      `I could not find that in "${reviewer.title}" or in the StudyTrack help. ` +
      'Try asking with a word that appears in your notes, or ask for a summary, a quiz, or flashcards.'
    )
  }

  return (
    "I'm not sure about that yet. I can help with StudyTrack features (subjects, schedule, tasks, exams, reviewers, " +
    'calendar, reminders, settings), give study tips, or quiz you on a reviewer you pick above. ' +
    'For other subjects, your teacher or textbook is the best source.'
  )
}
