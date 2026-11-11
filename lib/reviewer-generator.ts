// Builds a reviewer (summary, key terms, flashcards, quiz) from plain text using rules only.
// There is no AI here and none is needed. It reads headings, glossary lines, definitions, names, dates and numbers, and
// every answer it produces is copied from (or checked against) the student's own material.
import type { ReviewerContent } from './types'
import {
  STOP,
  capitalize,
  capitalsSeen,
  cleanTerm,
  clip,
  escapeRe,
  extractEntities,
  hash,
  niceTitle,
  norm,
  rng,
  shuffle,
  splitSentences,
  toBlocks,
  toSections,
  tokens,
  weakWord,
  words,
  type Entity,
  type Section,
} from './reviewer-text'

export { toBlocks, splitSentences, tokens as contentTokens }

export type GeneratedReviewer = { title: string; content: ReviewerContent }

export class ReviewerError extends Error {
  constructor(
    public code: 'too_short' | 'no_text',
    message: string,
  ) {
    super(message)
  }
}

export type Style = 'fresh' | 'easier' | 'harder'
export type GenerateOptions = {
  questionCount?: number
  flashcardCount?: number
  fallbackTitle?: string
  /** A different number gives a different mix of questions (used by the regenerate button). */
  salt?: number
  style?: Style
  /** Questions/answers to avoid repeating, as returned by signature(). */
  avoid?: Set<string>
}

// ---------- types ----------

type Kind = 'prose' | 'bullet' | 'def'
type Sentence = { text: string; raw: string; section: number; first: boolean; order: number; score: number; kind: Kind; entities: Entity[] }
type Term = { term: string; definition: string; strength: number; order: number; weak?: boolean; src?: 'def' | 'copula' | 'apposition' | 'abbr' | 'called' | 'entity' | 'bullet' }
type ClozeKind = Entity['kind'] | 'term' | 'word'
type Cloze = { sentence: string; answer: string; blanked: string; kind: ClozeKind; order: number; section: number; score: number }
type ListInfo = { heading: string; labels: string[] }
type Pools = { names: string[]; acronyms: string[]; years: number[]; terms: string[]; words: string[]; labels: string[]; where: Map<string, number>; text: string }
type Analysis = {
  blocks: ReturnType<typeof toBlocks>
  sections: Section[]
  sentences: Sentence[]
  tf: Map<string, number>
  terms: Term[]
  clozes: Cloze[]
  lists: ListInfo[]
  pools: Pools
  text: string
}

const wordRe = (s: string, flags = 'iu') => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(s)}(?![\\p{L}\\p{N}])`, flags)
const hasWord = (text: string, s: string) => wordRe(s).test(text)
const stripMarks = (s: string) => s.replace(/\*\*/g, '')
const sentenceEnd = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`)

// ---------- key terms ----------

const BAD_START = /^(this|that|these|those|it|its|there|here|he|she|they|we|you|i|which|who|what|when|where|how|why|if|as|so|but|and|or)\b/i
const BAD_TERM_START =
  /^(overall|main|first|second|third|another|other|others|some|many|most|several|various|same|such|following|above|previous|next|last|one|two|three|each|every|all|both|no|any|whole|entire|general|certain|particular|specific)\b/i
const COPULA =
  /^(.{2,70}?)\s+(is defined as|are defined as|can be defined as|is known as|are known as|is called|are called|refers to|refer to|stands for|means|is|are)\s+(.{12,})$/
const TAGALOG = /^(?:Ang\s+)?(\p{Lu}[\p{L}-]*(?:\s+(?!ay\b)[\p{L}-]+){0,3}?)\s+(?:ay\s+(?=ang\s|isang\s|ito\s|tumutukoy\s|dami\s|mga\s|proseso\s|paraan\s|uri\s|bahagi\s|kalagayan\s|sistema\s)|tumutukoy\s+sa\s+)(.{12,})$/u
const CALLED =
  /^(.{8,90}?),?\s+(?:also\s+)?(?:called|known as|termed|referred to as|tinatawag na|tinawag na)\s+(?:the\s+)?(\p{L}[\p{L}' -]{2,40}?)(?=,|\.|;|\s+(?:have|has|is|are|was|were|which|that|who|can|will|would|may|might|do|does|did)\b|$)/u
const APPOSITIVE =
  /(\p{Lu}[\p{L}'’-]*(?:\s+(?:of|the|de|la)?\s*\p{Lu}[\p{L}'’-]*){0,3}),\s+((?:a|an|the|ang|isang)\s+[^,.;]{8,140}?)(?=,|\.|;|$)/u
const INTRO_WORDS = new Set('in on at during after before by from with for to noong sa'.split(' '))
const SMALL_WORDS = new Set('of the and for de la'.split(' '))

function termOk(t: string) {
  if (t.length < 2 || t.length > 60) return false
  const w = words(t)
  if (w.length > 6) return false
  if (BAD_START.test(t) || BAD_TERM_START.test(t)) return false
  if (w.every((x) => STOP.has(x.toLowerCase()))) return false
  if (/[,;]/.test(t)) return false
  if (!/\p{L}{3}/u.test(t)) return false
  return true
}

/** A definition must be real words, not a formula or a fragment. */
function defOk(d: string) {
  if (d.length < 12) return false
  const alpha = d.replace(/[^\p{L}]/gu, '').length
  const real = words(d).filter((x) => x.replace(/[^\p{L}]/gu, '').length >= 3).length
  return real >= 3 && alpha / d.length >= 0.6
}

/** "The pigment is found in the membranes" or "The optimum temperature for most plants is about 25 degrees"
 *  are facts about something, not definitions, so they must not become key terms or flashcards. */
function notDefinition(term: string, def: string) {
  const d = def.trim().replace(/^that\s+/i, '')
  if (/^(found|located|situated|seen|shown|kept|stored|placed|present|contained)\s+(in|on|at|within|inside|under|among|between)\b/i.test(d)) return true
  if (/^(about|approximately|around|roughly|nearly|almost|\d)/i.test(d) && words(term).length >= 3) return true
  return false
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

/** "Adenosine triphosphate (ATP)": checks that the capital letters really spell the acronym. */
function expandAcronym(before: string, acr: string): string | null {
  const ws = words(before.replace(/[,;:]+$/, ''))
  const picked: string[] = []
  let i = acr.length - 1
  for (let k = ws.length - 1; k >= 0 && i >= 0; k--) {
    const w = ws[k]
    if (SMALL_WORDS.has(w.toLowerCase())) {
      picked.unshift(w)
      continue
    }
    if (w[0].toUpperCase() !== acr[i]) return null
    picked.unshift(w)
    i--
  }
  if (i >= 0) return null
  while (picked.length && SMALL_WORDS.has(picked[0].toLowerCase())) picked.shift()
  return picked.length ? picked.join(' ') : null
}

function termsFromSentence(sentence: string, order: number, headingTerms: Set<string>): Term[] {
  const out: Term[] = []
  const s = sentence.trim()
  const push = (term: string, def: string, strength: number, src: Term['src'], loose = false) => {
    const t = cleanTerm(term)
    const d = finishDefinition(def)
    if (!termOk(t) || (!loose && !defOk(d)) || (loose && d.length < 4)) return false
    if (src === 'copula' && notDefinition(t, d)) return false
    out.push({ term: t, definition: d, strength, order, src })
    return true
  }

  // **Bold term** is/:/- definition
  const bold = /^\*\*(.{2,60}?)\*\*\s*(?:\(([^)]{1,20})\))?\s*(?:is|are|refers to|means|[:–—-])\s*(.{10,})$/.exec(s)
  if (bold && push(bold[1], bold[3], 4, 'def')) return out

  const plain = s.replace(/\*\*/g, '')

  // Adenosine triphosphate (ATP) ...
  for (const m of plain.matchAll(/\(([\p{Lu}][\p{Lu}\d]{1,7})\)/gu)) {
    const full = expandAcronym(plain.slice(0, m.index), m[1])
    if (full) push(m[1], full, 3, 'abbr', true)
  }

  // Term: definition   /   Term - definition
  const colon = /^(\p{L}[^:.!?]{1,50}?)\s*(?::|\s[–—-]\s)\s*(.{12,})$/u.exec(plain)
  if (colon) {
    const term = cleanTerm(colon[1])
    if (termOk(term) && words(term).length <= 5 && !/\b(is|are|was|were)\b/i.test(term) && push(term, colon[2], 3, 'def')) return out
  }

  // "plants that live in dry places, called xerophytes, ..."
  const called = CALLED.exec(plain)
  if (
    called &&
    words(called[1]).length <= 9 &&
    !/\b(was|were|is|are|been|be|being)$/i.test(called[1].trim()) &&
    !STOP.has(words(called[2])[0].toLowerCase()) &&
    !INTRO_WORDS.has(words(called[2])[0].toLowerCase()) &&
    push(called[2], called[1], 2.5, 'called')
  )
    return out

  // "the Bastille, a fortress prison in Paris, ..."
  const ap = APPOSITIVE.exec(plain)
  if (ap) {
    const startsAt = ap.index ?? 0
    const lead = words(ap[1])[0].toLowerCase()
    const endsWithComma = plain[(ap.index ?? 0) + ap[0].length] === ','
    const isClause = /\b(is|are|was|were|has|have|had|works?|do|does|did|can|will|would|should|must|shows?|says?|states?|believes?|argues?|means?)\b/i.test(ap[2])
    if (!INTRO_WORDS.has(lead) && !STOP.has(lead) && !isClause && (startsAt > 0 || endsWithComma) && push(ap[1], ap[2], 2.5, 'apposition')) return out
  }

  const m = COPULA.exec(plain)
  if (m) {
    const term = cleanTerm(m[1])
    const w = words(term)
    const capitalized = /^\p{Lu}/u.test(term) || headingTerms.has(term.toLowerCase())
    if (termOk(term) && (w.length <= 3 || capitalized) && w.length <= 5 && !/^(it|he|she|they)\b/i.test(term)) {
      if (push(term, m[3], capitalized || headingTerms.has(term.toLowerCase()) ? 2 : 1, 'copula')) return out
    }
  }

  // "A shortage occurs when ..."  and  "Elasticity measures how ..."
  const when = /^(.{2,40}?)\s+(?:occurs|happens|takes place)\s+(when\s+.{12,})$/.exec(plain)
  if (when && words(when[1]).length <= 4 && push(when[1], when[2], 2, 'copula')) return out
  const verbDef = /^(\p{Lu}[\p{L} -]{2,40}?)\s+((?:measures|describes|represents|indicates|denotes)\s+.{12,})$/u.exec(plain)
  if (verbDef && words(verbDef[1]).length <= 3 && push(verbDef[1], verbDef[2], 1.5, 'copula')) return out

  const t = TAGALOG.exec(plain)
  if (t) {
    const term = cleanTerm(t[1])
    if (termOk(term) && words(term).length <= 4) push(term, t[2].replace(/^(tumutukoy sa|ang|isang|ito)\s+/i, ''), 2, 'copula')
  }
  return out
}

// ---------- analysing the text ----------

function analyze(rawText: string): Analysis {
  const text = rawText.slice(0, 250_000)
  if (!text.trim()) throw new ReviewerError('no_text', 'No readable text was found.')
  if (text.replace(/\s+/g, ' ').trim().length < 150) {
    throw new ReviewerError('too_short', 'There is too little text to make a reviewer.')
  }

  const blocks = toBlocks(text)
  const sections = toSections(blocks)

  const raws: { raw: string; section: number; first: boolean; kind: Kind }[] = []
  sections.forEach((sec, si) => {
    sec.defs.forEach((d) => raws.push({ raw: d, section: si, first: false, kind: 'def' }))
    sec.paragraphs.forEach((p) => splitSentences(p).forEach((s, k) => raws.push({ raw: s, section: si, first: k === 0, kind: 'prose' })))
    sec.bullets.forEach((b) => raws.push({ raw: b, section: si, first: false, kind: 'bullet' }))
  })
  const seen = capitalsSeen(raws.map((r) => stripMarks(r.raw)))
  const sentences: Sentence[] = raws.map((r, order) => {
    const t = stripMarks(r.raw)
    return { text: t, raw: r.raw, section: r.section, first: r.first, order, score: 0, kind: r.kind, entities: extractEntities(t, seen) }
  })
  if (sentences.length < 3) throw new ReviewerError('too_short', 'There is too little text to make a reviewer.')

  // Word frequencies for scoring.
  const tf = new Map<string, number>()
  for (const s of sentences) for (const w of tokens(s.text)) tf.set(w, (tf.get(w) ?? 0) + 1)
  const maxTf = Math.max(1, ...tf.values())

  const headingWords = new Set(sections.flatMap((s) => (s.heading ? tokens(s.heading) : [])))
  const CUES = /\b(is|are|means|refers to|consists? of|includes?|causes?|results? in|because|therefore|due to|leads? to|stages?|steps?|types?|purpose|function|tumutukoy|layunin|sanhi|bunga)\b/i
  for (const s of sentences) {
    const tk = tokens(s.text)
    if (tk.length < 4) continue
    let score = tk.reduce((n, w) => n + (tf.get(w) ?? 0) / maxTf, 0) / Math.pow(tk.length, 0.7)
    if (s.first) score *= 1.35
    if (tk.some((w) => headingWords.has(w))) score *= 1.15
    if (s.entities.length) score *= 1.1
    if (s.entities.some((e) => e.kind === 'date' || e.kind === 'number')) score *= 1.1
    if (CUES.test(s.text)) score *= 1.15
    if (!s.first && /^(this|that|these|those|it|they|he|she|ito|iyon)\b/i.test(s.text)) score *= 0.65
    if (/^(however|but|also|moreover|furthermore|for example|for instance)\b/i.test(s.text)) score *= 0.8
    if (s.text.length > 320 || s.text.length < 35) score *= 0.5
    if (s.text.replace(/[^\p{L}]/gu, '').length / Math.max(1, s.text.length) < 0.7) score *= 0.35 // formulas, tables
    if (/\?$/.test(s.text)) score *= 0.3
    s.score = score
  }

  // ----- key terms -----
  const headingTerms = new Set(sections.flatMap((s) => (s.heading ? [s.heading.toLowerCase()] : [])))
  const found: Term[] = []
  for (const s of sentences) {
    for (const t of termsFromSentence(s.raw, s.order, headingTerms)) {
      found.push(s.kind === 'bullet' ? { ...t, src: 'bullet', strength: Math.min(t.strength, 2) } : t)
    }
  }
  const byKey = new Map<string, Term>()
  for (const t of found) {
    const key = t.term.toLowerCase()
    const prev = byKey.get(key)
    if (!prev || t.strength > prev.strength) byKey.set(key, t)
  }
  const lowerText = text.toLowerCase()
  const termFreq = (t: Term) => Math.min(5, lowerText.split(t.term.toLowerCase()).length - 1) / 5
  let terms = [...byKey.values()]
    .sort((a, b) => b.strength + termFreq(b) - (a.strength + termFreq(a)))
    .slice(0, 14)
    .sort((a, b) => a.order - b.order)

  // Few definitions? Use the important names, dates and ideas, each explained by the sentence it comes from.
  if (terms.length < 8) {
    const have = new Set(terms.map((t) => t.term.toLowerCase()))
    const stats = new Map<string, { text: string; kind: Entity['kind']; count: number; inHeading: boolean; words: number }>()
    for (const s of sentences) {
      for (const e of s.entities) {
        if (e.kind !== 'name' && e.kind !== 'acronym') continue
        const key = e.text.toLowerCase()
        if (!stats.has(key)) {
          stats.set(key, {
            text: e.text,
            kind: e.kind,
            count: Math.max(1, lowerText.split(key).length - 1),
            inHeading: [...headingTerms].some((h) => h.includes(key)),
            words: words(e.text).length,
          })
        }
      }
    }
    const ranked = [...stats.entries()]
      .map(([key, v]) => ({ key, ...v, score: Math.min(v.count, 6) + (v.words > 1 ? 2 : 0) + (v.inHeading ? 2.5 : 0) + (v.kind === 'acronym' ? 1 : 0) }))
      .filter((v) => v.count >= 2 || v.words > 1 || v.inHeading || v.kind === 'acronym')
      .sort((a, b) => b.score - a.score)
    const used = new Set<string>(terms.map((t) => t.definition))
    for (const v of ranked) {
      if (terms.length >= 12) break
      const overlaps = [...have].some((h) => h === v.key || h.includes(v.key) || v.key.includes(h))
      if (overlaps) continue
      const best = sentences
        .filter((s) => s.kind === 'prose' && s.text.length >= 45 && s.text.length <= 280 && hasWord(s.text, v.text))
        .map((s) => ({ s, pos: s.text.toLowerCase().indexOf(v.key) / Math.max(1, s.text.length) }))
        .sort((a, b) => b.s.score - 0.4 * b.pos - (a.s.score - 0.4 * a.pos))[0]
      if (!best) continue
      const definition = clip(sentenceEnd(best.s.text).replace(/[.;:]+$/, ''), 240)
      if (used.has(definition)) continue
      used.add(definition)
      terms.push({ term: cleanTerm(v.text), definition, strength: 0, order: best.s.order, weak: true, src: 'entity' })
      have.add(v.key)
    }
    terms = terms.sort((a, b) => a.order - b.order)
  }

  // ----- fill-in-the-blank candidates -----
  const strong = terms.filter((t) => !t.weak && t.strength >= 2).map((t) => t.term)
  const clozes = buildClozes(sentences, strong, tf)

  // ----- lists (bullets under a heading) -----
  const lists: ListInfo[] = []
  sections.forEach((sec) => {
    if (!sec.heading || sec.bullets.length < 3 || sec.bullets.length > 10) return
    const labels = sec.bullets.map((b) => bulletLabel(stripMarks(b)))
    if (labels.every((l) => l.length >= 3)) lists.push({ heading: sec.heading, labels })
  })

  // ----- pools used for wrong answers -----
  const allEntities = sentences.flatMap((s) => s.entities)
  const uniq = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()]
  const nameTokens = new Set(allEntities.filter((e) => e.kind !== 'date' && e.kind !== 'number').flatMap((e) => tokens(e.text)))
  const lowerUse = (w: string) => (text.match(new RegExp(`(?<![\\p{L}])${escapeRe(w)}(?![\\p{L}])`, 'gu')) ?? []).length
  const where = new Map<string, number>()
  for (const s of sentences) for (const e of s.entities) if (!where.has(norm(e.text))) where.set(norm(e.text), s.section)
  for (const t of terms) {
    const src = sentences.find((s) => s.order === t.order)
    if (src && !where.has(norm(t.term))) where.set(norm(t.term), src.section)
  }
  const pools: Pools = {
    text,
    where,
    names: uniq(allEntities.filter((e) => e.kind === 'name').map((e) => e.text)),
    acronyms: uniq(allEntities.filter((e) => e.kind === 'acronym').map((e) => e.text)),
    years: [...new Set(allEntities.filter((e) => /^\d{4}$/.test(e.text)).map((e) => Number(e.text)))],
    terms: terms.map((t) => t.term),
    words: [...tf.entries()].filter(([w, n]) => n >= 2 && w.length >= 5 && !weakWord(w) && !STOP.has(w) && !nameTokens.has(w) && lowerUse(w) >= 2).map(([w]) => w),
    labels: lists.flatMap((l) => l.labels),
  }

  return { blocks, sections, sentences, tf, terms, clozes, lists, pools, text }
}

function bulletLabel(b: string) {
  const colon = /^([^:]{2,60}?):\s+\S/.exec(b)
  const label = colon && words(colon[1]).length <= 6 ? colon[1] : b
  return clip(label.replace(/[.;:,%\s]+$/, ''), 70)
}

// ---------- fill-in-the-blank ----------

function buildClozes(sentences: Sentence[], strongTerms: string[], tf: Map<string, number>): Cloze[] {
  const out: Cloze[] = []
  const ranked = [...sentences].filter((s) => s.kind !== 'def').sort((a, b) => b.score - a.score)
  for (const s of ranked) {
    if (s.text.length < 45 || s.text.length > 230 || /\?$/.test(s.text) || /^(it|this|that|these|those|they|he|she|ito|iyon|iyan)\b/i.test(s.text)) continue
    type Cand = { text: string; kind: ClozeKind; rank: number }
    const cands: Cand[] = []
    for (const t of strongTerms) if (t.length >= 3 && hasWord(s.text, t)) cands.push({ text: t, kind: 'term', rank: 1 })
    for (const e of s.entities) {
      const multi = words(e.text).length > 1
      if (e.kind === 'name') cands.push({ text: e.text, kind: 'name', rank: multi ? 1.5 : 2.8 })
      else if (e.kind === 'date') cands.push({ text: e.text, kind: 'date', rank: 2 })
      else if (e.kind === 'number') cands.push({ text: e.text, kind: 'number', rank: 2.5 })
      else if (e.kind === 'acronym') cands.push({ text: e.text, kind: 'acronym', rank: 2.2 })
    }
    const inEntity = new Set(s.entities.flatMap((e) => tokens(e.text)))
    const keyword = tokens(s.text)
      .filter((w) => w.length >= 7 && !weakWord(w) && (tf.get(w) ?? 0) >= 2 && !inEntity.has(w) && (tf.get(w) ?? 0) / Math.max(1, sentences.length) <= 0.18)
      .sort((a, b) => b.length - a.length)[0]
    if (keyword) cands.push({ text: keyword, kind: 'word', rank: 4 })

    const options = cands
      .filter((c) => c.text.length >= 3 && c.text.length <= 60)
      .sort((a, b) => a.rank - b.rank || b.text.length - a.text.length)
    let done = 0
    const seenAns = new Set<string>()
    for (const c of options) {
      if (done >= 2) break
      const key = c.text.toLowerCase()
      if (seenAns.has(key)) continue
      const re = wordRe(c.text, 'giu')
      const m = wordRe(c.text).exec(s.text)
      if (!m) continue
      const answer = m[0]
      const times = (s.text.match(wordRe(c.text, 'giu')) ?? []).length
      if (c.kind === 'word' && times > 1) continue
      const blanked = s.text.replace(re, '_____')
      if (c.kind === 'word' && /^(?:the|a|an|ang|ito)\s+_{5}\b/i.test(blanked)) continue // answer would depend on a previous sentence
      if (tokens(blanked.replace(/_____/g, ' ')).length < 5) continue
      if (blanked.startsWith('_____') && s.text.length < 60) continue
      if (/^_{5}\s*[:–—-]/.test(blanked)) continue
      seenAns.add(key)
      out.push({ sentence: s.text, answer, blanked, kind: c.kind, order: s.order, section: s.section, score: s.score / (c.rank + done) })
      done++
    }
    if (out.length >= 80) break
  }
  return out.sort((a, b) => b.score - a.score)
}

// ---------- wrong answers that fit the right answer ----------

const MONTH_NAMES = 'January February March April May June July August September October November December'.split(' ')
const isCapStart = (s: string) => /^\p{Lu}/u.test(s)
const isAllCaps = (s: string) => s.length > 1 && s === s.toUpperCase() && /\p{L}/u.test(s)

function fakeNumbers(answer: string): string[] {
  const nums = [...answer.matchAll(/\d+(?:[.,]\d+)?/g)]
  if (!nums.length) return []
  const factors = [0.5, 0.75, 1.25, 1.5, 2, 0.6, 3]
  const outs: string[] = []
  for (const f of factors) {
    let ok = true
    const t = answer.replace(/\d+(?:[.,]\d+)?/g, (n) => {
      const v = Number(n.replace(',', '.'))
      if (!isFinite(v) || v === 0) ok = false
      const nv = Number.isInteger(v) ? Math.round(v * f) : Math.round(v * f * 10) / 10
      if (nv === v || nv <= 0) ok = false
      return String(nv)
    })
    if (ok && t !== answer) outs.push(t)
  }
  return outs
}

function fakeDates(answer: string): string[] {
  if (/^\d{4}$/.test(answer)) {
    const y = Number(answer)
    return [-1, 1, -2, 2, -3, 3, -5, 5, -10, 10].map((d) => String(y + d)).filter((x) => Number(x) <= new Date().getFullYear() + 1)
  }
  const m = new RegExp(`^(${MONTH_NAMES.join('|')})\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?$`).exec(answer)
  if (!m) {
    const my = new RegExp(`^(${MONTH_NAMES.join('|')})\s+(\\d{4})$`).exec(answer)
    if (!my) return []
    const mi = MONTH_NAMES.indexOf(my[1])
    return [1, -1, 2, 3].map((d) => `${MONTH_NAMES[(mi + d + 12) % 12]} ${my[2]}`).concat([`${my[1]} ${Number(my[2]) + 1}`, `${my[1]} ${Number(my[2]) - 1}`])
  }
  const [, month, day, year] = m
  const d = Number(day)
  const mi = MONTH_NAMES.indexOf(month)
  const fmt = (mo: string, dd: number, yy?: number) => `${mo} ${dd}${yy ? `, ${yy}` : ''}`
  const out: string[] = []
  for (const dd of [d + 1, d - 1, d + 3, d - 3, d + 7, d + 10]) if (dd >= 1 && dd <= 28 && dd !== d) out.push(fmt(month, dd, year ? Number(year) : undefined))
  if (year) {
    out.push(fmt(month, d, Number(year) + 1), fmt(month, d, Number(year) - 1))
    out.push(fmt(MONTH_NAMES[(mi + 1) % 12], d, Number(year)))
  }
  return out
}

/** Picks 3 wrong answers of the same kind as the right one, or returns null if nothing sensible exists. */
const commonPrefix = (a: string, b: string) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}
/** Roughly tells people ("Jose Rizal") apart from ideas ("Water availability") so they are not mixed up. */
const isPersonLike = (s: string) => {
  const w = words(s)
  return w.length >= 2 && w.length <= 3 && w.every((x) => /^\p{Lu}/u.test(x) && !SMALL_WORDS.has(x.toLowerCase())) && !isAllCaps(s)
}

function distractorsFor(c: { answer: string; kind: ClozeKind; stem: string; section?: number }, pools: Pools, rand: () => number, easy = false): string[] | null {
  const stemN = norm(c.stem)
  const ansN = norm(c.answer)
  const ansTokens = new Set(tokens(c.answer))
  const unique = (xs: string[]) => [...new Map(xs.map((x) => [norm(x), x])).values()]
  const notInStem = (x: string) => !stemN.includes(norm(x)) && norm(x) !== ansN

  if (c.kind === 'date' || c.kind === 'number') {
    const real = c.kind === 'date' && /^\d{4}$/.test(c.answer) ? pools.years.map(String) : []
    const pool = unique([...real.filter((y) => y !== c.answer), ...(c.kind === 'date' ? fakeDates(c.answer) : fakeNumbers(c.answer))]).filter(notInStem)
    // Real years from the text first (nearest to the answer), then made-up ones.
    const near = (x: string) => Math.abs(Number(x) - Number(c.answer))
    const realFirst = real.length ? pool.filter((x) => real.includes(x)).sort((a, b) => near(a) - near(b)).slice(0, 2) : []
    const rest = shuffle(pool.filter((x) => !realFirst.includes(x)), rand)
    const picked = [...realFirst, ...rest].slice(0, 3)
    return picked.length === 3 ? picked : null
  }

  const wc = words(c.answer).length
  let pool: string[]
  if (c.kind === 'word') pool = pools.words
  else pool = [...pools.terms, ...pools.names, ...pools.acronyms]
  // Wrong answers must look like the right one: if the answer is a lowercase word ("shortage"), only words that
  // really appear in lowercase in the notes are used, and they are shown in lowercase. Otherwise the capital
  // letter alone would give the answer away.
  if (/^\p{Ll}/u.test(c.answer)) {
    const lowerSeen = (x: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(x[0].toLowerCase() + x.slice(1))}(?![\\p{L}\\p{N}])`, 'u').test(pools.text)
    pool = pool.filter((x) => !isAllCaps(x) && lowerSeen(x)).map((x) => x[0].toLowerCase() + x.slice(1))
  } else if (c.kind !== 'word') {
    pool = pool.map(capitalize)
  }
  const cap = isCapStart(c.answer)
  const stemWords = norm(c.stem).split(' ').filter((w) => w.length >= 5)
  const person = isPersonLike(c.answer)
  const similar = (x: string) => {
    const xn = norm(x)
    return commonPrefix(xn, ansN) >= 5 || stemWords.some((w) => commonPrefix(xn.split(' ')[0], w) >= 5 && w !== xn.split(' ')[0])
  }
  const scored = unique(pool)
    .filter(notInStem)
    .filter((x) => tokens(x).every((t) => !ansTokens.has(t)) && !norm(x).includes(ansN) && !ansN.includes(norm(x)))
    .filter((x) => isPersonLike(x) === person && !similar(x))
    .map((x) => {
      const sameShape = (isCapStart(x) === cap ? 0 : 5) + (isAllCaps(x) === isAllCaps(c.answer) ? 0 : 4)
      const near = !easy && c.section !== undefined && pools.where.get(norm(x)) === c.section ? -2 : 0
      const score = 3 * Math.abs(words(x).length - wc) + Math.abs(x.length - c.answer.length) / 3 + sameShape + near + (c.kind === 'word' && x.slice(-3) === c.answer.slice(-3) ? -1.5 : 0)
      return { x, score }
    })
  const picked = shuffle(scored, rand)
    .sort((a, b) => a.score - b.score)
    .filter((s) => s.score <= 11)
    .slice(0, 3)
    .map((s) => s.x)
  return picked.length === 3 ? picked : null
}

// ---------- summary ----------

const jaccard = (a: Set<string>, b: Set<string>) => {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n / Math.max(1, a.size + b.size - n)
}

function sectionTitle(h: string | null, title: string) {
  if (!h) return null
  const t = niceTitle(h.replace(/^\d+(\.\d+)*[.)]?\s+/, '').replace(/^(chapter|lesson|module|unit|topic|aralin|kabanata)\s+\d+\s*[:.-]?\s*/i, '')).trim()
  if (!t) return null
  const a = new Set(tokens(t))
  const b = new Set(tokens(title))
  let both = 0
  for (const x of a) if (b.has(x)) both++
  return a.size === 0 || both / a.size >= 0.8 ? null : t
}

function buildSummary(a: Analysis, title: string): string {
  const { sentences, sections, terms } = a
  const prose = sentences.filter((s) => s.kind === 'prose' && s.score > 0)
  const ranked = [...prose].sort((x, y) => y.score - x.score)
  const main = ranked[0]
  const support = ranked.slice(1, 4).map((s) => sentenceEnd(s.text))
  const importantTerms = terms.filter((t) => !t.weak).slice(0, 3)

  const lines: string[] = []
  lines.push(`${title}`)
  lines.push('')
  lines.push('Main idea:')
  lines.push(main ? sentenceEnd(main.text) : 'No main idea was found in the notes.')
  lines.push('')
  lines.push('Key points:')
  if (support.length) {
    for (const point of support) lines.push(`• ${point}`)
  } else {
    lines.push('• The notes focus on the main topic and its supporting details.')
  }
  lines.push('')
  lines.push('Must remember:')
  if (importantTerms.length) {
    for (const term of importantTerms) lines.push(`• ${term.term}: ${term.definition}`)
  } else {
    lines.push('• Review the main topic and its supporting facts.')
  }
  lines.push('')
  lines.push('Quick check:')
  if (importantTerms.length) {
    lines.push(`• Focus on: ${importantTerms.map((t) => t.term).join(' • ')}`)
  } else {
    lines.push('• Check the strongest details from the notes before answering a question.')
  }

  return lines.join('\n')
}

// ---------- flashcards ----------

function buildFlashcards(a: Analysis, title: string, count: number, o: { rand: () => number; style: Style; avoid: Set<string>; varied: boolean }): ReviewerContent['flashcards'] {
  const cards: ReviewerContent['flashcards'] = []
  const seenQ = new Set<string>()
  const seenA = new Map<string, number>()
  const skipped: ReviewerContent['flashcards'] = []
  const add = (question: string, answer: string, repeatOk = false) => {
    const qk = norm(question)
    const ak = norm(answer)
    if (!answer.trim() || seenQ.has(qk) || cards.length >= count) return
    if ((seenA.get(ak) ?? 0) >= 1 && !repeatOk) return
    const card = { question, answer }
    if (o.avoid.has(signature(question, answer))) {
      skipped.push(card)
      return
    }
    seenQ.add(qk)
    seenA.set(ak, (seenA.get(ak) ?? 0) + 1)
    cards.push(card)
  }

  const defTerms = a.terms.filter((t) => !t.weak)
  const weakTerms = a.terms.filter((t) => t.weak)
  const orderTerms = o.varied ? shuffle(defTerms, o.rand) : defTerms
  const cap = Math.min(8, Math.ceil(count * 0.6))
  let n = 0
  for (const t of orderTerms) {
    if (n >= cap) break
    const q = t.src === 'bullet' ? `Explain: ${t.term}` : t.src === 'abbr' ? `What does ${t.term} stand for?` : t.src === 'called' ? `What is the name for: ${t.definition.toLowerCase()}?` : `What is ${t.term}?`
    const ans = t.src === 'called' ? t.term : t.definition
    const before = cards.length
    add(q, ans)
    if (cards.length > before) n++
  }
  for (const t of (o.varied ? shuffle(weakTerms, o.rand) : weakTerms).slice(0, 3)) add(`What does the text say about ${t.term}?`, t.definition)

  // Lists and section explanations.
  let lists = 0
  a.sections.forEach((sec, si) => {
    if (!sec.heading) return
    const h = sectionTitle(sec.heading, title) ?? niceTitle(sec.heading)
    if (a.lists.some((l) => l.heading === sec.heading) && lists < 3) {
      lists++
      add(`List the items under "${h}".`, sec.bullets.map((b) => `• ${clip(stripMarks(b), 140)}`).join('\n'))
      return
    }
    if (a.terms.some((t) => t.term.toLowerCase() === sec.heading!.toLowerCase())) return
    const top = a.sentences
      .filter((s) => s.section === si && s.kind === 'prose' && s.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 2)
      .sort((x, y) => x.order - y.order)
    if (top.length >= 2 || (top.length === 1 && top[0].text.length > 60)) add(`Explain: ${h}`, clip(top.map((s) => sentenceEnd(s.text)).join(' '), 320))
  })

  // Fill in the blank.
  const usedBlank = new Set<string>()
  const cloze = a.clozes.filter((c) => c.kind !== 'word' || o.style !== 'easier')
  const ordered = o.varied ? shuffle(cloze.slice(0, 40), o.rand) : cloze
  const sentenceUsed = new Set<string>()
  for (const pass of [1, 2]) {
    for (const c of ordered) {
      if (cards.length >= (pass === 1 ? count : Math.min(count, 8))) break
      if (usedBlank.has(norm(c.answer)) || sentenceUsed.has(c.sentence)) continue
      usedBlank.add(norm(c.answer))
      sentenceUsed.add(c.sentence)
      add(`Fill in the blank: ${c.blanked}`, c.answer)
    }
    sentenceUsed.clear()
  }
  if (cards.length < 6) {
    ;[...a.sentences]
      .filter((s) => s.kind === 'prose')
      .sort((x, y) => y.score - x.score)
      .slice(0, 8)
      .forEach((s) => add(`Complete this idea: ${s.text.split(' ').slice(0, 5).join(' ')} …`, sentenceEnd(s.text)))
  }
  for (const c of skipped) if (cards.length < Math.min(count, 6)) cards.push(c)
  return cards
}

// ---------- quiz ----------

export const signature = (question: string, answer: string) => `${norm(question)}|${norm(answer)}`

function buildQuiz(a: Analysis, count: number, o: { rand: () => number; style: Style; avoid: Set<string>; varied: boolean }): ReviewerContent['quiz'] {
  const { rand } = o
  const quiz: ReviewerContent['quiz'] = []
  const seen = new Set<string>()
  const usedAnswers = new Set<string>()
  const usedSentences = new Set<string>()
  const skipped: ReviewerContent['quiz'] = []

  const add = (question: string, correct: string, wrong: string[], explanation: string, sentenceKey?: string) => {
    const qk = norm(question)
    if (seen.has(qk) || usedAnswers.has(norm(correct)) || wrong.length < 3 || quiz.length >= count) return false
    if (sentenceKey && usedSentences.has(sentenceKey)) return false
    const options = shuffle([correct, ...wrong.slice(0, 3)], rand)
    if (new Set(options.map(norm)).size !== 4) return false
    const item = { question, options, answer_index: options.indexOf(correct), explanation }
    if (o.avoid.has(signature(question, correct))) {
      skipped.push(item)
      return false
    }
    seen.add(qk)
    usedAnswers.add(norm(correct))
    if (sentenceKey) usedSentences.add(sentenceKey)
    quiz.push(item)
    return true
  }

  const definable = a.terms.filter((t) => !t.weak && t.src !== 'abbr' && t.definition.length >= 20 && t.definition.length <= 230)
  const termShape = (t: string) => ({ cap: isCapStart(t), n: words(t).length })
  const closeTerms = (t: Term) => {
    const s = termShape(t.term)
    return a.terms
      .filter((x) => x.term !== t.term && !(x.src === 'entity' && x.weak && !isCapStart(t.term)))
      .map((x) => ({ x: x.term, score: 3 * Math.abs(termShape(x.term).n - s.n) + (termShape(x.term).cap === s.cap ? 0 : 5) + Math.abs(x.term.length - t.term.length) / 3 }))
      .sort((p, q) => p.score - q.score)
  }

  const clozeQueue = o.style === 'harder' ? [...a.clozes].sort((x, y) => (y.kind === 'word' ? 0 : 1) - (x.kind === 'word' ? 0 : 1) || y.score - x.score) : o.varied ? shuffle(a.clozes.slice(0, 60), o.rand) : a.clozes.slice(0, 60)
  const queues = {
    cloze: clozeQueue,
    byDefinition: shuffle(definable, rand),
    byTerm: shuffle(definable, rand),
    list: shuffle(a.lists.flatMap((l) => l.labels.map((label) => ({ l, label }))), rand),
  }
  const orders: Record<Style, (keyof typeof queues)[]> = {
    fresh: ['cloze', 'byDefinition', 'list', 'byTerm', 'cloze'],
    easier: ['byDefinition', 'byTerm', 'cloze', 'byDefinition', 'list'],
    harder: ['cloze', 'cloze', 'list', 'byDefinition', 'byTerm'],
  }
  const order = orders[o.style]

  let guard = 0
  const maxGuard = count * 14
  while (quiz.length < count && guard++ < maxGuard) {
    const kind = order[guard % order.length]
    if (kind === 'cloze') {
      const c = queues.cloze.shift()
      if (!c) continue
      if (o.style === 'easier' && c.kind === 'word') continue
      const wrong = distractorsFor({ answer: c.answer, kind: c.kind, stem: c.sentence, section: c.section }, a.pools, rand, o.style === 'easier')
      if (wrong) add(`Complete the sentence: ${c.blanked}`, c.answer, wrong, c.sentence, norm(c.sentence))
    } else if (kind === 'byDefinition') {
      const t = queues.byDefinition.shift()
      if (!t) continue
      if (norm(t.definition).includes(norm(t.term))) continue
      const wrong = closeTerms(t).filter((w) => !norm(t.definition).includes(norm(w.x))).slice(0, 3).map((w) => w.x)
      add(`Which term matches this description? "${clip(t.definition, 160)}"`, t.term, wrong, `${t.term}: ${t.definition}`)
    } else if (kind === 'byTerm') {
      const t = queues.byTerm.shift()
      if (!t) continue
      const right = clip(t.definition, 130)
      const lenOk = (d: string) => d.length > right.length * 0.4 && d.length < right.length * 2.5
      const wrong = shuffle(
        definable.filter((x) => x.term !== t.term && !norm(x.definition).includes(norm(t.term))).map((x) => clip(x.definition, 130)).filter((d) => lenOk(d) && jaccard(new Set(tokens(d)), new Set(tokens(right))) > 0.1),
        rand,
      ).slice(0, 3)
      add(t.src === 'bullet' ? `What does the text say about ${t.term}?` : `What is ${t.term}?`, right, wrong, `${t.term}: ${t.definition}`)
    } else {
      const item = queues.list.shift()
      if (!item) continue
      const own = item.l.labels.map(norm)
      const wc = words(item.label).length
      const headingN = norm(item.l.heading)
      const inList = (x: string) => headingN.includes(norm(x)) || own.some((o) => o === norm(x) || o.includes(norm(x)) || norm(x).includes(o))
      const wrong = shuffle(
        [...a.pools.labels, ...a.pools.terms, ...a.pools.names].filter((x) => !isPersonLike(x) && !inList(x) && x.length <= 70 && Math.abs(words(x).length - wc) <= 2),
        rand,
      )
        .map((x) => ({ x, score: 2 * Math.abs(words(x).length - wc) + (isCapStart(x) === isCapStart(item.label) ? 0 : 3) }))
        .sort((p, q) => p.score - q.score)
        .filter((s, i, arr) => arr.findIndex((z) => norm(z.x) === norm(s.x)) === i)
        .slice(0, 3)
        .map((s) => s.x)
      add(`Which of these is listed under "${sectionTitle(item.l.heading, '') ?? niceTitle(item.l.heading)}"?`, item.label, wrong, `${niceTitle(item.l.heading)}: ${item.l.labels.join('; ')}`)
    }
    if (!queues.cloze.length && !queues.byDefinition.length && !queues.byTerm.length && !queues.list.length) break
  }
  for (const q of skipped) if (quiz.length < Math.min(count, 4)) quiz.push(q)
  return quiz
}

// ---------- title ----------

function pickTitle(a: Analysis, options: GenerateOptions) {
  const first = a.blocks.find((b) => b.type === 'heading')
  const given = options.fallbackTitle?.trim()
  const generic = !given || given === 'My notes'
  let title = (first?.text ?? '').trim()
  if (!title && !generic) title = given!
  if (!title) {
    const topName = a.terms.filter((t) => t.src === 'entity').sort((x, y) => words(y.term).length - words(x.term).length)[0]
    const strongest = a.terms.filter((t) => !t.weak).sort((x, y) => y.strength - x.strength)[0]
    title = (topName && words(topName.term).length > 1 ? topName.term : strongest?.term) || given || 'My reviewer'
    if (generic && title !== 'My reviewer') title = `Notes: ${title}`
  }
  return clip(niceTitle(title), 80)
}

// ---------- main entry points ----------

export function generateReviewer(rawText: string, options: GenerateOptions = {}): GeneratedReviewer {
  const a = analyze(rawText)
  const style = options.style ?? 'fresh'
  const avoid = options.avoid ?? new Set<string>()
  const rand = rng(hash(a.text.slice(0, 400)) ^ a.text.length ^ ((options.salt ?? 0) * 2654435761))
  const title = pickTitle(a, options)
  const varied = options.salt !== undefined

  return {
    title,
    content: {
      summary: buildSummary(a, title),
      key_terms: a.terms.map((t) => ({ term: t.term, definition: t.definition })),
      flashcards: buildFlashcards(a, title, Math.min(15, options.flashcardCount ?? 15), { rand, style, avoid, varied }),
      quiz: buildQuiz(a, options.questionCount ?? 10, { rand, style, avoid, varied }),
    },
  }
}

/**
 * Makes a fresh set of flashcards or quiz questions from an existing reviewer, with no AI and no internet.
 * It only uses what the reviewer already contains (summary, key terms, and the sentences behind old questions),
 * so every new answer is still grounded in the student's own material.
 */
export function regenerateSection(
  content: Pick<ReviewerContent, 'summary' | 'key_terms' | 'flashcards' | 'quiz'>,
  kind: 'flashcards' | 'quiz',
  options: { count?: number; style?: Style; salt?: number } = {},
): ReviewerContent['flashcards'] | ReviewerContent['quiz'] {
  const sentencesBehind = [...new Set(content.quiz.map((q) => q.explanation).filter((e) => e && !/^[^:]{2,60}:\s/.test(e) && e.length > 40))]
  const pseudo = [
    content.summary,
    content.key_terms.map((t) => `${t.term}: ${t.definition}`).join('\n'),
    ...sentencesBehind,
  ]
    .filter(Boolean)
    .join('\n\n')

  const previous = kind === 'quiz' ? content.quiz.map((q) => signature(q.question, q.options[q.answer_index] ?? '')) : content.flashcards.map((c) => signature(c.question, c.answer))
  const count = Math.min(15, options.count ?? (kind === 'quiz' ? content.quiz.length : content.flashcards.length) ?? 10) || 10
  const result = generateReviewer(pseudo, {
    questionCount: count,
    flashcardCount: count,
    style: options.style ?? 'fresh',
    salt: options.salt ?? Date.now() % 100000,
    avoid: new Set(previous),
  })
  const items = kind === 'quiz' ? result.content.quiz : result.content.flashcards
  if (items.length < 3) throw new ReviewerError('too_short', 'There is not enough material to make a new set.')
  return items
}
