// Accuracy checks for a reviewer. No AI and no internet: it only compares each answer with the student's own text.
//
// Why it exists: any generator can make a broken question. Every key term, flashcard answer, quiz answer and
// summary sentence is checked against the source material, and anything the notes do not support is dropped.
import type { ReviewerContent } from './types'
import { STOP, norm, splitSentences, tokens } from './reviewer-text'

type Content = Pick<ReviewerContent, 'summary' | 'key_terms' | 'flashcards' | 'quiz'>

export type Source = { stems: Set<string>; numbers: Set<string> }

/** Cuts a word down so "converts", "converted" and "converting" match. */
const stem = (w: string) => {
  const base = w.length > 5 ? w.replace(/(?:ing|ed|es|ly|s)$/, '') : w
  return base.slice(0, 7)
}
const numberKey = (n: string) => n.replace(/(?<=\d),(?=\d{3}\b)/g, '').replace(',', '.')
const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map(numberKey)

// Words that belong to the question, not to the notes ("Define: ...", "Which of these ...").
const QUESTION_WORDS = new Set(
  'define explain describe list name identify state give compare differentiate complete fill blank sentence term matches description correct following listed under text say says stand mean means example examples true false choose select best answer'.split(' '),
)

export function prepareSource(text: string): Source {
  return { stems: new Set(tokens(text).map(stem)), numbers: new Set(numbersIn(text)) }
}

/** Share of a claim's meaningful words found in the source (1 = all of them). */
function overlap(claim: string, src: Source, ignoreQuestionWords = false) {
  const ws = tokens(claim).filter((w) => !(ignoreQuestionWords && QUESTION_WORDS.has(w)))
  if (!ws.length) return 1
  return ws.filter((w) => src.stems.has(stem(w))).length / ws.length
}

const numbersOk = (claim: string, src: Source) => numbersIn(claim).every((n) => src.numbers.has(n))

/** True when the notes support the claim: all numbers are in the notes, and enough of its words are too. */
export function isGrounded(claim: string, src: Source, min = 0.6, ignoreQuestionWords = false, exactShort = true) {
  if (!claim.trim()) return false
  if (!numbersOk(claim, src)) return false
  const count = tokens(claim).filter((w) => !(ignoreQuestionWords && QUESTION_WORDS.has(w))).length
  const ratio = overlap(claim, src, ignoreQuestionWords)
  // Very short answers ("Bagumbayan", "NADPH") must match completely.
  return exactShort && count <= 2 ? ratio === 1 : ratio >= min
}

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a)
  const B = new Set(b)
  let n = 0
  for (const x of A) if (B.has(x)) n++
  return n / Math.max(1, A.size + B.size - n)
}

const compare = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w))

const VAGUE_OPTION = /^(all|none|both|neither)\s+of\s+(the\s+)?(above|these|them)\b|^(a|b|c|d)\s+(and|or)\s+(a|b|c|d)$/i

export type VerifyReport = { summary: boolean; key_terms: number; flashcards: number; quiz: number }

/**
 * Keeps only what the notes support. Quiz questions that give their own answer away, or that have two options
 * meaning the same thing, are dropped too.
 */
export function verifyContent(content: Content, sourceText: string): { content: Content; dropped: VerifyReport } {
  const src = prepareSource(sourceText)
  const dropped: VerifyReport = { summary: false, key_terms: 0, flashcards: 0, quiz: 0 }

  // ----- summary: keep sentences the notes support; if most are invented, the whole summary goes -----
  let summary = ''
  const paragraphs = (content.summary ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  let total = 0
  let kept = 0
  const rebuilt: string[] = []
  for (const para of paragraphs) {
    const ok = splitSentences(para).filter((sentence) => {
      total++
      const good = isGrounded(sentence, src, 0.55)
      if (good) kept++
      return good
    })
    if (ok.length) rebuilt.push(ok.join(' '))
  }
  if (total > 0 && kept / total >= 0.6) summary = rebuilt.join('\n\n')
  else dropped.summary = paragraphs.length > 0

  // ----- key terms -----
  const seenTerms = new Set<string>()
  const key_terms = (content.key_terms ?? []).filter((t) => {
    const term = (t?.term ?? '').trim()
    const definition = (t?.definition ?? '').trim()
    const key = norm(term)
    const ok = !!term && !!definition && !seenTerms.has(key) && isGrounded(term, src, 1) && isGrounded(definition, src, 0.6)
    if (ok) seenTerms.add(key)
    else dropped.key_terms++
    return ok
  })

  // ----- flashcards -----
  const seenQuestions = new Set<string>()
  const flashcards = (content.flashcards ?? []).filter((c) => {
    const question = (c?.question ?? '').trim()
    const answer = (c?.answer ?? '').trim()
    const key = norm(question)
    const ok = question.length >= 5 && !!answer && !seenQuestions.has(key) && isGrounded(answer, src, 0.6) && isGrounded(question, src, 0.5, true, false)
    if (ok) seenQuestions.add(key)
    else dropped.flashcards++
    return ok
  })

  // ----- quiz -----
  const seenQuiz = new Set<string>()
  const quiz = (content.quiz ?? []).flatMap((q) => {
    const question = (q?.question ?? '').trim()
    const options = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? '').trim()) : []
    const idx = Number(q?.answer_index)
    const key = norm(question)
    const fail = () => {
      dropped.quiz++
      return []
    }
    if (question.length < 5 || options.length !== 4 || !Number.isInteger(idx) || idx < 0 || idx > 3 || seenQuiz.has(key)) return fail()
    if (options.some((o) => !o) || new Set(options.map(norm)).size !== 4) return fail()
    const correct = options[idx]
    if (!isGrounded(correct, src, 0.6)) return fail()
    if (!isGrounded(question, src, 0.5, true, false)) return fail()
    if (options.some((o) => VAGUE_OPTION.test(o))) return fail()
    if (norm(correct).length >= 4 && norm(question).includes(norm(correct))) return fail() // the question gives the answer
    // Compared with numbers included, so "25 degrees" and "40 degrees" are different options.
    const ct = compare(correct)
    if (options.some((o, i) => i !== idx && ct.length >= 2 && jaccard(ct, compare(o)) >= 0.85)) return fail() // two options mean the same
    if (options.some((o, i) => i !== idx && (norm(o).includes(norm(correct)) || norm(correct).includes(norm(o))))) return fail() // one option sits inside another ("Oxygen" / "Oxygen gas")
    // An explanation the notes do not support is removed, but the question stays.
    const explanation = (q?.explanation ?? '').trim()
    seenQuiz.add(key)
    return [{ question, options, answer_index: idx, explanation: explanation && isGrounded(explanation, src, 0.4) ? explanation : '' }]
  })

  return { content: { summary, key_terms, flashcards, quiz }, dropped }
}
