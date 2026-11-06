// Builds a reviewer (summary, key terms, flashcards, quiz) from plain text using simple rules.
// There is no AI here: it looks for headings, definitions, and the most important sentences.
import type { ReviewerContent } from './types'

export type GeneratedReviewer = { title: string; content: ReviewerContent }

export class ReviewerError extends Error {
  constructor(
    public code: 'too_short' | 'no_text',
    message: string,
  ) {
    super(message)
  }
}

const STOP = new Set(
  (
    'a an the and or but if then else when while of at by for with about against between into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just don should now is are was were be been being have has had having do does did doing i me my we our you your he him his she her it its they them their what which who whom this that these those am would could may might must shall also however therefore thus because as until via per etc ' +
    'ang ng sa na at ay mga ni kay para pero kung kapag habang ito iyon iyan ako ikaw siya kami tayo kayo sila ko mo niya namin natin ninyo nila hindi wala may mayroon din rin lang lamang po ba pa naman nang upang dahil'
  ).split(' '),
)

const ABBREVIATIONS = ['e.g.', 'i.e.', 'etc.', 'vs.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Fig.', 'No.', 'Inc.', 'approx.', 'cf.', 'et al.']

const GENERIC = new Set(
  'people time times years year made make makes many much most things thing used using also later first during because while other others could would their there which these those about after before become became often still even what when where second third early late high higher low lower new old large small long short'.split(' '),
)
const weakWord = (w: string) => /(?:ed|ing|ly)$/.test(w) || GENERIC.has(w)

// ---------- small helpers ----------

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const words = (s: string) => s.split(/\s+/).filter(Boolean)
const tokens = (s: string) =>
  (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

function clip(s: string, max: number) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[,;:\s]+$/, '')}…`
}

function cleanTerm(raw: string) {
  let t = raw
    .replace(/\*\*/g, '')
    .replace(/^[\s"“'‘(]+/, '')
    .replace(/[\s"”'’:,.;]+$/, '')
    .replace(/^(the|a|an|ang|ito)\s+/i, '')
    .trim()
  const open = (t.match(/\(/g) ?? []).length
  const close = (t.match(/\)/g) ?? []).length
  if (open > close) t += ')'.repeat(open - close)
  else if (close > open) t = t.replace(/\)+$/, '')
  return capitalize(t)
}

// ---------- reading the text: headings, bullets, paragraphs ----------

type Block = { type: 'heading' | 'bullet' | 'para'; text: string }
type Section = { heading: string | null; paragraphs: string[]; bullets: string[] }

const BULLET = /^\s*(?:[-•*▪●◦‣]|\d{1,2}[.)]|[a-z][.)])\s+(.+)$/
const HEADING_WORD = /^(chapter|lesson|module|unit|topic|part|section|kabanata|aralin|yunit)\b/i

function looksLikeHeading(line: string, hasBodyAfter: boolean) {
  const t = line.trim()
  if (t.length < 3 || t.length > 80) return false
  if (/[.!?,;]$/.test(t)) return false
  const w = words(t)
  if (w.length > 10) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  const upperRatio = letters ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0
  if (letters.length >= 4 && upperRatio > 0.7) return true
  if (HEADING_WORD.test(t)) return true
  if (/^\d+(\.\d+)*[.)]?\s+\S/.test(t) && w.length <= 8) return true
  const capitalized = w.filter((x) => /^[A-Z0-9]/.test(x) || STOP.has(x.toLowerCase())).length
  return hasBodyAfter && w.length <= 7 && capitalized === w.length && /[A-Za-z]/.test(t)
}

export function toBlocks(raw: string): Block[] {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\f/g, '\n\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/-\n(?=[a-z])/g, '')
  const lines = text.split('\n').map((l) => l.trim())
  const blocks: Block[] = []
  let para: string[] = []

  const flush = () => {
    if (para.length) {
      blocks.push({ type: 'para', text: para.join(' ').replace(/\s+/g, ' ').trim() })
      para = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) {
      flush()
      continue
    }
    const md = /^#{1,6}\s+(.+)$/.exec(line)
    if (md) {
      flush()
      blocks.push({ type: 'heading', text: md[1].replace(/\*\*/g, '').trim() })
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet) {
      flush()
      blocks.push({ type: 'bullet', text: bullet[1].trim() })
      continue
    }
    const next = lines.slice(i + 1).find((l) => l) ?? ''
    const colonHeading = /^[^.!?]{2,60}:$/.test(line) && BULLET.test(next)
    if (colonHeading) {
      flush()
      blocks.push({ type: 'heading', text: line.replace(/:$/, '') })
      continue
    }
    const prevBlank = i === 0 || !lines[i - 1]
    const lastBlock = blocks[blocks.length - 1]
    const afterSentence = para.length > 0 && /[.!?]$/.test(para[para.length - 1])
    if ((prevBlank || para.length === 0 || afterSentence) && looksLikeHeading(line, next.length > 0)) {
      flush()
      blocks.push({ type: 'heading', text: line.replace(/\*\*/g, '') })
      continue
    }
    // A line that continues a bullet from the line before (common in PDFs).
    if (para.length === 0 && lastBlock?.type === 'bullet' && !/[.!?]$/.test(lastBlock.text) && !prevBlank) {
      lastBlock.text = `${lastBlock.text} ${line}`
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

function toSections(blocks: Block[]): Section[] {
  const sections: Section[] = []
  let current: Section = { heading: null, paragraphs: [], bullets: [] }
  const push = () => {
    if (current.paragraphs.length || current.bullets.length || current.heading) sections.push(current)
  }
  for (const b of blocks) {
    if (b.type === 'heading') {
      push()
      current = { heading: b.text, paragraphs: [], bullets: [] }
    } else if (b.type === 'bullet') current.bullets.push(b.text)
    else current.paragraphs.push(b.text)
  }
  push()
  return sections
}

export function splitSentences(paragraph: string): string[] {
  let p = paragraph
  ABBREVIATIONS.forEach((a, i) => {
    p = p.split(a).join(a.replace(/\./g, `\u0001${i}\u0002`))
  })
  p = p.replace(/(\d)\.(\d)/g, '$1\u0003$2')
  const parts = p.split(/(?<=[.!?])["”')\]]*\s+(?=["“'(\[]?[A-Z0-9*])/)
  return parts
    .map((s) =>
      s
        .replace(/\u0003/g, '.')
        .replace(/\u0001(\d+)\u0002/g, (_, i) => '.'.repeat(0) + ABBREVIATIONS[Number(i)].slice(0, -1) + '.')
        .trim(),
    )
    .filter(Boolean)
}

// ---------- key terms (definitions) ----------

type Term = { term: string; definition: string; strength: number; order: number; weak?: boolean }

const BAD_START = /^(this|that|these|those|it|its|there|here|he|she|they|we|you|i|which|who|what|when|where|how|why|if|as|so|but|and|or)\b/i
const COPULA =
  /^(.{2,70}?)\s+(is defined as|are defined as|can be defined as|is known as|are known as|is called|are called|refers to|refer to|stands for|means|is|are)\s+(.{12,})$/
const TAGALOG = /^(?:Ang\s+)?([A-ZÑ][\p{L}-]*(?:\s+[\p{L}-]+){0,3}?)\s+(?:ay\s+(?=ang\s|isang\s|ito\s)|(?:tumutukoy sa|ibig sabihin ng)\s+)(.{10,})$/u

function termOk(t: string) {
  if (t.length < 2 || t.length > 60) return false
  const w = words(t)
  if (w.length > 6) return false
  if (BAD_START.test(t)) return false
  if (w.every((x) => STOP.has(x.toLowerCase()))) return false
  if (/[,;]/.test(t)) return false
  return true
}

function finishDefinition(rest: string) {
  const d = rest
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^that\s+/i, '')
    .replace(/[.;:]+$/, '')
  return clip(capitalize(d), 240)
}

function termsFromSentence(sentence: string, order: number, headingTerms: Set<string>): Term[] {
  const out: Term[] = []
  const s = sentence.trim()

  // **Bold term** is/:/- definition
  const bold = /^\*\*(.{2,60}?)\*\*\s*(?:\(([^)]{1,20})\))?\s*(?:is|are|refers to|means|[:–—-])\s*(.{10,})$/.exec(s)
  if (bold) {
    const term = cleanTerm(bold[1])
    if (termOk(term)) out.push({ term, definition: finishDefinition(bold[3]), strength: 4, order })
    return out
  }

  const plain = s.replace(/\*\*/g, '')

  // Term: definition   /   Term - definition
  const colon = /^([A-Za-zÑñ][^:.!?]{1,50}?)\s*(?::|\s[–—-]\s)\s*(.{12,})$/.exec(plain)
  if (colon) {
    const term = cleanTerm(colon[1])
    if (termOk(term) && words(term).length <= 5 && !/\b(is|are|was|were)\b/i.test(term)) {
      out.push({ term, definition: finishDefinition(colon[2]), strength: 3, order })
      return out
    }
  }

  const m = COPULA.exec(plain)
  if (m) {
    const term = cleanTerm(m[1])
    const verb = m[2]
    const w = words(term)
    const capitalized = /^[A-Z]/.test(term) || headingTerms.has(term.toLowerCase())
    if (termOk(term) && (w.length <= 3 || capitalized) && w.length <= 5) {
      const rest = verb === 'is' || verb === 'are' ? m[3] : m[3]
      out.push({
        term,
        definition: finishDefinition(rest),
        strength: capitalized || headingTerms.has(term.toLowerCase()) ? 2 : 1,
        order,
      })
      return out
    }
  }

  const t = TAGALOG.exec(plain)
  if (t) {
    const term = cleanTerm(t[1])
    if (termOk(term) && words(term).length <= 4) {
      out.push({ term, definition: finishDefinition(t[2].replace(/^(ang|isang|ito)\s+/i, (m) => m)), strength: 2, order })
    }
  }
  return out
}

// ---------- main generator ----------

type Sentence = { text: string; raw: string; section: number; first: boolean; order: number; score: number }

export function generateReviewer(
  rawText: string,
  options: { questionCount?: number; fallbackTitle?: string } = {},
): GeneratedReviewer {
  const text = rawText.slice(0, 250_000)
  if (!text.trim()) throw new ReviewerError('no_text', 'No readable text was found.')
  if (text.replace(/\s+/g, ' ').trim().length < 150) {
    throw new ReviewerError('too_short', 'There is too little text to make a reviewer.')
  }

  const questionCount = options.questionCount ?? 10
  const rand = rng(hash(text.slice(0, 400)) ^ text.length)
  const blocks = toBlocks(text)
  const sections = toSections(blocks)

  // Sentences with their section.
  const sentences: Sentence[] = []
  let order = 0
  sections.forEach((sec, si) => {
    sec.paragraphs.forEach((p) => {
      splitSentences(p).forEach((s, k) => {
        sentences.push({ text: s.replace(/\*\*/g, ''), raw: s, section: si, first: k === 0, order: order++, score: 0 })
      })
    })
    sec.bullets.forEach((b) => sentences.push({ text: b.replace(/\*\*/g, ''), raw: b, section: si, first: false, order: order++, score: 0 }))
  })
  if (sentences.length < 3) throw new ReviewerError('too_short', 'There is too little text to make a reviewer.')

  // Word frequencies for scoring.
  const tf = new Map<string, number>()
  for (const s of sentences) for (const w of tokens(s.text)) tf.set(w, (tf.get(w) ?? 0) + 1)
  const maxTf = Math.max(1, ...tf.values())

  const headingWords = new Set(sections.flatMap((s) => (s.heading ? tokens(s.heading) : [])))
  for (const s of sentences) {
    const tk = tokens(s.text)
    if (tk.length < 4) continue
    let score = tk.reduce((n, w) => n + (tf.get(w) ?? 0) / maxTf, 0) / Math.pow(tk.length, 0.7)
    if (s.first) score *= 1.35
    if (tk.some((w) => headingWords.has(w))) score *= 1.15
    if (/^(however|but|also|moreover|furthermore|for example|for instance)\b/i.test(s.text)) score *= 0.8
    if (s.text.length > 320 || s.text.length < 35) score *= 0.5
    if (/\?$/.test(s.text)) score *= 0.3
    s.score = score
  }

  // Key terms.
  const headingTerms = new Set(sections.flatMap((s) => (s.heading ? [s.heading.toLowerCase()] : [])))
  const found: Term[] = []
  for (const s of sentences) found.push(...termsFromSentence(s.raw, s.order, headingTerms))

  const byKey = new Map<string, Term>()
  for (const t of found) {
    const key = t.term.toLowerCase()
    const prev = byKey.get(key)
    if (!prev || t.strength > prev.strength) byKey.set(key, t)
  }
  const termFreq = (t: Term) => (tf.get(t.term.toLowerCase().split(' ')[0]) ?? 0) / maxTf
  let terms = [...byKey.values()]
    .sort((a, b) => b.strength + termFreq(b) - (a.strength + termFreq(a)))
    .slice(0, 15)
    .sort((a, b) => a.order - b.order)

  // Not many definitions? Fall back to the most repeated important words and phrases.
  if (terms.length < 8) {
    const have = new Set(terms.map((t) => t.term.toLowerCase()))

    const bigrams = new Map<string, number>()
    for (const s of sentences) {
      const w = (s.text.toLowerCase().match(/[\p{L}][\p{L}'-]*/gu) ?? []) as string[]
      for (let i = 0; i < w.length - 1; i++) {
        const [x, y] = [w[i], w[i + 1]]
        if (x.length < 4 || y.length < 4 || STOP.has(x) || STOP.has(y) || weakWord(x) || weakWord(y)) continue
        bigrams.set(`${x} ${y}`, (bigrams.get(`${x} ${y}`) ?? 0) + 1)
      }
    }
    const phrases = [...bigrams.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4)
    const inPhrase = new Set(phrases.flatMap(([p]) => p.split(' ')))
    const singles = [...tf.entries()]
      .filter(([w, n]) => n >= 2 && w.length >= 5 && !weakWord(w) && !inPhrase.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    const candidates: string[] = [...phrases.map(([p]) => p), ...singles.map(([w]) => w)]

    const usedSentences = new Set(terms.map((t) => t.definition))
    for (const c of candidates) {
      if (terms.length >= 9) break
      if (have.has(c)) continue
      const best = sentences
        .filter((s) => s.text.length >= 40 && s.text.toLowerCase().includes(c) && !usedSentences.has(clip(s.text.replace(/[.;:]+$/, ''), 240)))
        .sort((a, b) => b.score - a.score)[0]
      if (!best) continue
      const definition = clip(best.text.replace(/[.;:]+$/, ''), 240)
      usedSentences.add(definition)
      terms.push({ term: capitalize(c), definition, strength: 0, order: best.order, weak: true })
      have.add(c)
    }
    terms = terms.sort((a, b) => a.order - b.order)
  }

  // Summary: the best sentences, spread across the sections.
  const target = Math.min(12, Math.max(4, Math.round(sentences.length * 0.18)))
  const ranked = [...sentences].filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  const picked = new Map<number, Sentence>()
  for (const s of ranked.slice(0, target)) picked.set(s.order, s)
  sections.forEach((_, si) => {
    if (picked.size >= target + 3) return
    if ([...picked.values()].some((p) => p.section === si)) return
    const best = ranked.find((s) => s.section === si)
    if (best) picked.set(best.order, best)
  })
  const bySection = new Map<number, Sentence[]>()
  ;[...picked.values()]
    .sort((a, b) => a.order - b.order)
    .forEach((s) => bySection.set(s.section, [...(bySection.get(s.section) ?? []), s]))
  const summary = [...bySection.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([si, list]) => {
      const heading = sections[si].heading
      const body = list.map((s) => (/[.!?…]$/.test(s.text) ? s.text : `${s.text}.`)).join(' ')
      return heading ? `${heading}: ${body}` : body
    })
    .join('\n\n')

  // Flashcards.
  const flashcards: ReviewerContent['flashcards'] = []
  const seenQ = new Set<string>()
  const addCard = (question: string, answer: string) => {
    const key = question.toLowerCase()
    if (seenQ.has(key) || !answer.trim() || flashcards.length >= 15) return
    seenQ.add(key)
    flashcards.push({ question, answer })
  }
  terms.slice(0, 11).forEach((t) =>
    addCard(
      t.weak ? `What does the text say about ${t.term}?` : t.strength >= 3 ? `Define: ${t.term}` : `What is ${t.term}?`,
      t.definition,
    ),
  )

  sections.forEach((sec, si) => {
    if (flashcards.length >= 15) return
    if (sec.heading && sec.bullets.length >= 3 && sec.bullets.length <= 8) {
      addCard(`List the items under "${sec.heading}".`, sec.bullets.map((b) => `• ${clip(b.replace(/\*\*/g, ''), 140)}`).join('\n'))
    } else if (sec.heading && !terms.some((t) => t.term.toLowerCase() === sec.heading!.toLowerCase())) {
      const top = sentences
        .filter((s) => s.section === si && s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .sort((a, b) => a.order - b.order)
      if (top.length) addCard(`Explain: ${sec.heading}`, clip(top.map((s) => s.text).join(' '), 320))
    }
  })

  // Fill-in-the-blank candidates.
  const termSet = terms.map((t) => t.term)
  type Cloze = { sentence: string; answer: string; blanked: string }
  const clozes: Cloze[] = []
  for (const s of [...sentences].sort((a, b) => b.score - a.score)) {
    if (s.text.length < 45 || s.text.length > 220 || /\?$/.test(s.text)) continue
    let answer = termSet.find((t) => new RegExp(`(^|[^\\p{L}])${escapeRe(t)}([^\\p{L}]|$)`, 'iu').test(s.text) && t.length >= 3)
    if (!answer) {
      const caps = (s.text.slice(1).match(/\b[A-Z][\p{L}]{3,}\b/gu) ?? []).filter((c) => !STOP.has(c.toLowerCase()))
      const nums = s.text.match(/\b\d[\d,.]*%?\b/g) ?? []
      const longWord = tokens(s.text.slice(Math.min(20, s.text.length / 4))).sort((a, b) => b.length - a.length)[0]
      answer = caps[0] ?? nums[0] ?? (longWord && longWord.length >= 6 ? longWord : undefined)
    }
    if (!answer) continue
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(answer)}(?![\\p{L}\\p{N}])`, 'iu')
    const m = re.exec(s.text)
    if (!m) continue
    const blanked = s.text.replace(re, `${m[1]}_____`)
    if (blanked.startsWith('_____') && (s.text.length < 60 || /^_{5}\s*[:–—-]/.test(blanked))) continue
    clozes.push({ sentence: s.text, answer: matchCase(s.text, answer), blanked })
    if (clozes.length >= 30) break
  }
  const usedBlank = new Set<string>()
  for (const c of clozes) {
    if (flashcards.length >= 15) break
    if (usedBlank.has(c.answer.toLowerCase())) continue
    usedBlank.add(c.answer.toLowerCase())
    addCard(`Fill in the blank: ${c.blanked}`, c.answer)
  }
  if (flashcards.length < 6) {
    ;[...sentences]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .forEach((s) => addCard(`Complete this idea: ${s.text.split(' ').slice(0, 5).join(' ')} …`, s.text))
  }

  // Quiz.
  const quiz = buildQuiz(terms, clozes, tf, questionCount, rand)

  const first = blocks.find((b) => b.type === 'heading')
  let title = clip((first?.text ?? '').trim() || options.fallbackTitle?.trim() || 'My reviewer', 80)
  if (title.length > 3 && title === title.toUpperCase()) {
    title = title.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
  }

  return {
    title,
    content: {
      summary: summary || sentences.slice(0, 4).map((s) => s.text).join(' '),
      key_terms: terms.map((t) => ({ term: t.term, definition: t.definition })),
      flashcards,
      quiz,
    },
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchCase(sentence: string, answer: string) {
  const m = new RegExp(escapeRe(answer), 'i').exec(sentence)
  return m ? m[0] : answer
}

function buildQuiz(
  terms: Term[],
  clozes: { sentence: string; answer: string; blanked: string }[],
  tf: Map<string, number>,
  count: number,
  rand: () => number,
): ReviewerContent['quiz'] {
  const quiz: ReviewerContent['quiz'] = []
  const seen = new Set<string>()
  const usedAnswers = new Set<string>()

  const pool = [
    ...new Set([
      ...terms.map((t) => t.term),
      ...clozes.map((c) => c.answer),
      ...[...tf.entries()].filter(([w, n]) => n >= 2 && w.length >= 5 && !weakWord(w)).map(([w]) => capitalize(w)),
    ]),
  ]

  const distractors = (correct: string, source: string[], n = 3) => {
    const lc = correct.toLowerCase()
    const ok = source.filter((c) => {
      const x = c.toLowerCase()
      return x !== lc && !x.includes(lc) && !lc.includes(x) && c.trim().length > 0
    })
    const caps = /^[A-Z]/.test(correct)
    const scored = shuffle(ok, rand).sort((a, b) => {
      const da = Math.abs(a.length - correct.length) + (/^[A-Z]/.test(a) === caps ? 0 : 6)
      const db = Math.abs(b.length - correct.length) + (/^[A-Z]/.test(b) === caps ? 0 : 6)
      return da - db
    })
    return [...new Set(scored)].slice(0, n)
  }

  const add = (question: string, correct: string, wrong: string[], explanation: string) => {
    const key = question.toLowerCase()
    const answerKey = correct.toLowerCase()
    if (seen.has(key) || usedAnswers.has(answerKey) || wrong.length < 3 || quiz.length >= count) return false
    const options = shuffle([correct, ...wrong.slice(0, 3)], rand)
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return false
    seen.add(key)
    usedAnswers.add(answerKey)
    quiz.push({ question, options, answer_index: options.indexOf(correct), explanation })
    return true
  }

  const definable = terms.filter((t) => !t.weak && t.definition.length >= 20)
  const queues = {
    cloze: [...clozes],
    byDefinition: shuffle(definable, rand),
    byTerm: shuffle(definable, rand),
  }
  const order: (keyof typeof queues)[] = ['cloze', 'byDefinition', 'byTerm']

  let guard = 0
  while (quiz.length < count && guard++ < count * 8) {
    const kind = order[guard % order.length]
    if (kind === 'cloze') {
      const c = queues.cloze.shift()
      if (!c) continue
      add(`Complete the sentence: ${c.blanked}`, c.answer, distractors(c.answer, pool), c.sentence)
    } else if (kind === 'byDefinition') {
      const t = queues.byDefinition.shift()
      if (!t || definable.length < 4) continue
      if (usedAnswers.has(t.term.toLowerCase())) continue
      add(`Which term matches this description? "${clip(t.definition, 160)}"`, t.term, distractors(t.term, terms.map((x) => x.term)), `${t.term}: ${t.definition}`)
    } else {
      const t = queues.byTerm.shift()
      if (!t || definable.length < 4) continue
      if (usedAnswers.has(t.term.toLowerCase())) continue
      const others = definable.filter((x) => x.term !== t.term).map((x) => clip(x.definition, 130))
      if (add(`What is ${t.term}?`, clip(t.definition, 130), distractors(clip(t.definition, 130), others), `${t.term}: ${t.definition}`)) usedAnswers.add(t.term.toLowerCase())
    }
    if (!queues.cloze.length && !queues.byDefinition.length && !queues.byTerm.length) break
  }
  return quiz
}
