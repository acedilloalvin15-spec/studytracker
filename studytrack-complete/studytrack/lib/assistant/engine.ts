// Free, key-less assistant. Answers come from:
// 1) safety rules, 2) the reviewer the student chose, 3) Study Pulse help articles,
// 4) Wikipedia's public search and summary service (free, no API key).
import { findHelpArticles, type HelpArticle } from '@/lib/assistant/knowledge'
import type { ReviewerContent } from '@/lib/types'

export type ReviewerInput = { title: string; content: ReviewerContent }

const MAX_ARTICLE_CHARS = 700
const UA = 'StudyPulse/1.0 (student study app)'

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'was', 'be', 'i', 'my', 'me', 'it',
  'this', 'that', 'with', 'at', 'from', 'about', 'tell', 'you', 'your', 'please', 'can', 'could', 'would', 'give',
  'what', 'who', 'whom', 'which', 'how', 'why', 'when', 'where', 'do', 'does', 'did', 'explain', 'define', 'meaning',
  'mean', 'simply', 'briefly', 'some', 'want', 'know',
])

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
}

// Questions about the assistant's own system, or about hacking, are never answered.
const SYSTEM_OR_HACK =
  /\b(your (system|prompt|instructions?|code|source|api|database|server|password|model|weights|training|hidden)|system prompt|jailbreak|ignore (all |your |previous )?(rules|instructions)|are you (a |an )?(ai|bot|chatbot|llm|claude|gpt|language model)|hack(ing|er|ers|ed|s)?\b|sql injection|ddos|malware|phishing|exploit (code|for)|crack (a |the |someone's )?password|bypass (the )?(login|password|security|authentication))/i

const SAFE_REFUSAL =
  "I can't help with that. I can't share details about my own system, and I don't help with hacking. " +
  'I can help with your studies or with how to use Study Pulse.'

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|kumusta)\b/i
const APP_QUESTION =
  /\b(how (do|can|to)|where|can i|why (won'?t|isn'?t|doesn'?t|can'?t)|not (working|showing)|button|settings?|page|reminder|notification|upload|account|password reset|log ?in|sign ?in|calendar|schedule|task|subject|reviewer)\b/i
const GENERAL_QUESTION = /\b(what|who|define|explain|meaning|tell me about|history of|why is|why are|when was|where is)\b/i

const TIPS = [
  'Study in short blocks of 25 to 45 minutes, then take a 5 minute break.',
  'Test yourself instead of only rereading. Close your notes and try to explain the topic.',
  'Review a little every day. Spacing out study sessions helps you remember more.',
  'Turn key terms into flashcards and go through them until they feel easy.',
  'Start with the hardest topic while your mind is fresh.',
]

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

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

/** Answers note questions only when a meaningful part of the question matches the reviewer. */
function reviewerAnswer(message: string, { title, content }: ReviewerInput): string | null {
  const lower = message.toLowerCase()

  if (/\bsummar(y|ize|ise)\b/.test(lower)) {
    return `Summary of "${title}":\n\n${content.summary || 'This reviewer has no summary.'}`
  }
  if (/\bflash ?cards?\b/.test(lower)) {
    if (!content.flashcards?.length) return 'This reviewer has no flashcards.'
    const f = pick(content.flashcards)
    return `${f.question}\n\nTry to answer first. Answer: ${f.answer}`
  }
  if (/\b(quiz|test me|practice|question me)\b/.test(lower)) {
    if (!content.quiz?.length) return 'This reviewer has no quiz questions.'
    const q = pick(content.quiz)
    const options = q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')
    const correct = `${String.fromCharCode(65 + q.answer_index)}. ${q.options[q.answer_index]}`
    return `${q.question}\n\n${options}\n\nTry it first, then check: Answer: ${correct}${q.explanation ? `\n${q.explanation}` : ''}`
  }

  const qWords = new Set(words(message))
  if (!qWords.size) return null

  const terms = content.key_terms ?? []
  const exactTerm = terms.find((t) => {
    const termWords = words(t.term)
    return termWords.length > 0 && termWords.every((w) => qWords.has(w))
  })
  if (exactTerm) return `${exactTerm.term}: ${exactTerm.definition}`

  const matchedLines = [
    ...bestSentences(content.summary ?? '', message),
    ...terms
      .map((t) => `${t.term}: ${t.definition}`)
      .filter((line) => words(line).filter((w) => qWords.has(w)).length >= Math.min(2, qWords.size)),
  ]
  const unique = [...new Set(matchedLines)]
  if (!unique.length) return null
  return `From your reviewer "${title}":\n\n- ${unique.slice(0, 3).join('\n- ')}`
}

/** Asks Wikipedia (free, no key) for a short summary of the best matching article. */
async function wikipediaAnswer(message: string): Promise<string | null> {
  const query = words(message).slice(0, 5).join(' ')
  if (!query) return null
  try {
    const search = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) },
    )
    if (!search.ok) return null
    const data = (await search.json()) as [string, string[]]
    const title = data[1]?.[0]
    if (!title) return null

    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) return null
    const page = (await res.json()) as { extract?: string; content_urls?: { desktop?: { page?: string } } }
    if (!page.extract) return null

    const short = page.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ').slice(0, 600)
    const url = page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
    return `${short}\n\nSource: Wikipedia (${url})`
  } catch {
    return null
  }
}

function appAnswer(articles: HelpArticle[]): string | null {
  if (!articles.length) return null
  const [article] = articles
  const body = article.body.length > MAX_ARTICLE_CHARS ? article.body.slice(0, MAX_ARTICLE_CHARS) + '…' : article.body
  return `${article.title}\n\n${body}`
}

export async function answerQuestion(message: string, reviewer: ReviewerInput | null): Promise<string> {
  const text = message.trim()

  if (!text) return 'Please ask a study question or a Study Pulse question.'
  if (SYSTEM_OR_HACK.test(text)) return SAFE_REFUSAL

  if (GREETING.test(text)) {
    return 'Hi, I\'m Study Buddie! I can explain school topics, help you use Study Pulse, give study tips, or quiz you on a reviewer. What would you like to do?'
  }

  if (/\b(tip|tips|how to study|study better|study habits|advice)\b/i.test(text)) {
    return 'Here are some study tips:\n\n- ' + TIPS.join('\n- ')
  }

  const articles = findHelpArticles(text, 1)
  const appFirst = APP_QUESTION.test(text)

  // App questions are answered from the documented feature guide before any public source.
  if (appFirst) {
    const app = appAnswer(articles)
    if (app) return app
  }

  if (reviewer) {
    const fromReviewer = reviewerAnswer(text, reviewer)
    if (fromReviewer) return fromReviewer
  }

  // Don't let a broad, accidental keyword match masquerade as an answer to an unrelated app question.
  if (articles.length && appFirst) return appAnswer(articles) ?? 'I could not find a matching Study Pulse help article. Please try asking about a specific page or feature.'

  if (GENERAL_QUESTION.test(text) || !appFirst) {
    const general = await wikipediaAnswer(text)
    if (general) return general
  }

  if (reviewer) {
    return `I couldn't find that in "${reviewer.title}". Try a key term from your notes, or ask for a summary, a quiz, or flashcards.`
  }

  return 'I’m not confident enough to answer that from the information available. Try a clearer topic name or ask about a specific Study Pulse feature.'
}
