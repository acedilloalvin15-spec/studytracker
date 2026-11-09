// Reading helpers for the rules-based reviewer maker (no AI): word lists, headings, sentences, and
// a small "who/what/when" finder (names, dates, numbers, acronyms).

export const STOP = new Set(
  (
    'a an the and or but if then else when while of at by for with about against between into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just don should now is are was were be been being have has had having do does did doing i me my we our you your he him his she her it its they them their what which who whom this that these those am would could may might must shall also however therefore thus because as until via per etc ' +
    'ang ng sa na at ay mga ni kay para pero kung kapag habang ito iyon iyan ako ikaw siya kami tayo kayo sila ko mo niya namin natin ninyo nila hindi wala may mayroon din rin lang lamang po ba pa naman nang upang dahil ' +
    'noong nung si sina nina kina o pati ngunit subalit kaya sapagkat samantala tungkol mula hanggang ayon iba ibang lahat bawat buong bilang pamamagitan dito doon rito roon kanilang kanila kaniyang naging maging isang dalawang tatlong unang pagkatapos bago matapos ngayon noon palagi minsan man nga daw raw kasi'
  ).split(' '),
)

export const ABBREVIATIONS = ['e.g.', 'i.e.', 'etc.', 'vs.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Fig.', 'No.', 'Inc.', 'approx.', 'cf.', 'et al.', 'St.', 'Jr.', 'Sr.']

export const GENERIC = new Set(
  'people time times years year made make makes many much most things thing used using also later first during because while other others could would their there which these those about after before become became often still even what when where second third early late high higher low lower new old large small long short good great important different various several number amount part parts way ways kind kinds type types example examples overall main general following'.split(' '),
)
export const weakWord = (w: string) => /(?:ed|ing|ly)$/.test(w) || GENERIC.has(w)

const MONTHS = 'January February March April May June July August September October November December Enero Pebrero Marso Abril Mayo Hunyo Hulyo Agosto Setyembre Oktubre Nobyembre Disyembre'.split(' ')
const MONTH_SET = new Set(MONTHS.map((m) => m.toLowerCase()))
const DAY_SET = new Set('monday tuesday wednesday thursday friday saturday sunday lunes martes miyerkules huwebes biyernes sabado linggo'.split(' '))
const CONNECTORS = new Set(['of', 'the', 'de', 'del', 'la', 'ng', 'von', 'van', 'der', 'du', 'da'])
// Words that, after a capitalised name, usually complete a named idea ("Calvin cycle", "Hooke's law").
const HEAD_NOUNS = new Set(
  'cycle law laws theory theorem principle rule effect process reaction equation syndrome system curve war revolution empire dynasty act treaty doctrine movement period era river mountain ocean party model method constant scale disease virus pyramid code'.split(' '),
)

// ---------- small helpers ----------

export function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

export function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const words = (s: string) => s.split(/\s+/).filter(Boolean)
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Meaningful words of a text (lowercase, no tiny or filler words). */
export const tokens = (s: string) =>
  (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

/** Lowercase, no accents or punctuation: used to compare texts. */
export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function clip(s: string, max: number) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[,;:\s]+$/, '')}…`
}

export function cleanTerm(raw: string) {
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

const SMALL = new Set('of the and in on at to for a an or nor but ng sa ang mga ay at na si ni kay'.split(' '))
/** "CHAPTER ONE: THE CELL" becomes "Chapter One: The Cell"; normal titles are left alone. */
export function niceTitle(s: string) {
  const t = s.trim()
  const letters = t.replace(/[^\p{L}]/gu, '')
  if (letters.length < 4 || letters !== letters.toUpperCase()) return t
  return t
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i, all) => (i > 0 && SMALL.has(w) && !/:$/.test(all[i - 2] ?? '') ? w : w.replace(/^\p{L}/u, (c) => c.toUpperCase())))
    .join('')
}

// ---------- reading the text: headings, bullets, glossary lines, paragraphs ----------

export type Block = { type: 'heading' | 'bullet' | 'def' | 'para'; text: string }

const BULLET = /^\s*(?:[-•*▪●◦‣]|\d{1,2}[.)]|[a-z][.)])\s+(.+)$/
const HEADING_WORD = /^(chapter|lesson|module|unit|topic|part|section|kabanata|aralin|yunit)\b/i
// "Term: definition" or "Term - definition" on a line of its own.
const DEFLINE = /^(?:\*\*)?(\p{Lu}[^:.!?]{1,48}?)(?:\*\*)?\s*(?::|\s[–—-]\s)\s*(.{12,})$/u
const NOT_A_TERM = /^(note|notes|example|examples|tip|remember|summary|objective|objectives|answer|question|figure|table|source|step|hint|reminder|definition|sample|task|activity|chapter|lesson|unit|topic)\b/i

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

/** Drops page numbers and headers/footers that repeat on every PDF page. */
function dropNoise(lines: string[]) {
  const seen = new Map<string, number>()
  for (const l of lines) if (l && l.length < 70) seen.set(l, (seen.get(l) ?? 0) + 1)
  return lines.map((l) => {
    if (!l) return l
    if (/^(?:page\s+)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?$/i.test(l)) return ''
    if ((seen.get(l) ?? 0) >= 3 && l.length < 70 && !BULLET.test(l)) return ''
    return l
  })
}

export function toBlocks(raw: string): Block[] {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\f/g, '\n\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/-\n(?=[a-z])/g, '')
  const lines = dropNoise(text.split('\n').map((l) => l.trim()))
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
    if (/^[^.!?]{2,60}:$/.test(line) && BULLET.test(next)) {
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
    // A line that wraps from the line before (common in PDFs): it must start in lowercase.
    // A capital letter means a new sentence, so it is never glued onto a list item.
    if (para.length === 0 && !prevBlank && lastBlock && (lastBlock.type === 'bullet' || lastBlock.type === 'def') && /^[\p{Ll}(]/u.test(line)) {
      lastBlock.text = `${lastBlock.text} ${line}`
      continue
    }
    // A glossary line of its own: "Term: meaning".
    if (para.length === 0) {
      const d = DEFLINE.exec(line)
      if (d && words(d[1]).length <= 5 && !NOT_A_TERM.test(d[1]) && !/\b(is|are|was|were|ay)\b/i.test(d[1])) {
        flush()
        blocks.push({ type: 'def', text: line.replace(/\*\*/g, '') })
        continue
      }
    }
    para.push(line)
  }
  flush()
  return blocks
}

export type Section = { heading: string | null; paragraphs: string[]; bullets: string[]; defs: string[] }

export function toSections(blocks: Block[]): Section[] {
  const sections: Section[] = []
  let current: Section = { heading: null, paragraphs: [], bullets: [], defs: [] }
  const push = () => {
    if (current.paragraphs.length || current.bullets.length || current.defs.length || current.heading) sections.push(current)
  }
  for (const b of blocks) {
    if (b.type === 'heading') {
      push()
      current = { heading: b.text, paragraphs: [], bullets: [], defs: [] }
    } else if (b.type === 'bullet') current.bullets.push(b.text)
    else if (b.type === 'def') current.defs.push(b.text)
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
  p = p.replace(/(^|\s)([A-Z])\.(?=\s+[A-Z][a-z])/g, '$1$2\u0004') // initials such as "J. Rizal"
  const parts = p.split(/(?<=[.!?])["”')\]]*\s+(?=["“'(\[]?[A-Z0-9*])/)
  return parts
    .map((s) =>
      s
        .replace(/\u0003/g, '.')
        .replace(/\u0004/g, '.')
        .replace(/\u0001(\d+)\u0002/g, (_, i) => ABBREVIATIONS[Number(i)].slice(0, -1) + '.')
        .trim(),
    )
    .filter(Boolean)
}

// ---------- finding names, dates, numbers and acronyms in a sentence ----------

export type Entity = { text: string; kind: 'name' | 'acronym' | 'date' | 'number'; start: number; end: number }

const MONTH_ALT = MONTHS.join('|')
const DATE_RE = new RegExp(`\\b(?:${MONTH_ALT})\\s+\\d{4}\\b|\\b(?:${MONTH_ALT})\\.?\\s+\\d{1,2}(?!\\d)(?:st|nd|rd|th)?(?:,?\\s+\\d{4}\\b)?`, 'g')
const YEAR_RE = /\b(?:1[0-9]{3}|20[0-9]{2})\b/g
const UNIT = '(?:%|percent\\b|degrees?(?:\\s+(?:Celsius|Fahrenheit))?|°\\s?[CF]\\b|kg\\b|km\\b|cm\\b|mm\\b|ml\\b|mg\\b|hours?\\b|minutes?\\b|seconds?\\b|years?\\b|days?\\b|months?\\b|weeks?\\b|taon\\b|araw\\b|buwan\\b)'
const NUM_UNIT_RE = new RegExp(`\\b\\d+(?:[.,]\\d+)?(?:\\s?(?:to|-|–|hanggang)\\s?\\d+(?:[.,]\\d+)?)?\\s?${UNIT}`, 'gi')
const TOKEN = /[\p{L}\p{M}][\p{L}\p{M}'’-]*|\d[\d,.]*\d|\d/gu
const ROMAN = /^(?=[IVXLC])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/
const isCap = (t: string) => /^\p{Lu}/u.test(t)
const isAcr = (t: string) => /^\p{Lu}[\p{Lu}\d]{1,7}$/u.test(t) && !ROMAN.test(t)

/** Words that appear with a capital letter in the middle of a sentence anywhere in the text. */
export function capitalsSeen(sentences: string[]): Set<string> {
  const seen = new Set<string>()
  for (const s of sentences) {
    const toks = [...s.matchAll(TOKEN)]
    toks.forEach((m, k) => {
      if (k > 0 && isCap(m[0]) && !STOP.has(m[0].toLowerCase())) seen.add(m[0].toLowerCase())
    })
  }
  return seen
}

export function extractEntities(sentence: string, seen: Set<string>): Entity[] {
  const out: Entity[] = []
  const taken: [number, number][] = []
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x)
  const take = (text: string, kind: Entity['kind'], start: number) => {
    out.push({ text, kind, start, end: start + text.length })
    taken.push([start, start + text.length])
  }

  for (const m of sentence.matchAll(DATE_RE)) if (free(m.index!, m.index! + m[0].length)) take(m[0].replace(/\.$/, ''), 'date', m.index!)
  for (const m of sentence.matchAll(NUM_UNIT_RE)) if (free(m.index!, m.index! + m[0].length)) take(m[0].trim(), 'number', m.index!)
  for (const m of sentence.matchAll(YEAR_RE)) if (free(m.index!, m.index! + m[0].length)) take(m[0], 'date', m.index!)

  const toks = [...sentence.matchAll(TOKEN)].map((m) => ({ t: m[0], i: m.index!, e: m.index! + m[0].length }))
  for (let k = 0; k < toks.length; k++) {
    const first = toks[k]
    if (!isCap(first.t) || !free(first.i, first.e)) continue
    let end = k
    let hasOf = false
    for (;;) {
      const n = toks[end + 1]
      if (!n || !free(n.i, n.e)) break
      if (isCap(n.t)) {
        end++
        continue
      }
      if (end > k && (ROMAN.test(n.t) || /^\d{1,3}$/.test(n.t)) && isCap(toks[end].t) && sentence.slice(toks[end].e, n.i).trim() === '') {
        end++
        break
      }
      // "of the", "de la", "and of the" (only inside names that already contain "of")
      let j = end + 1
      const run: string[] = []
      while (toks[j] && !isCap(toks[j].t) && run.length < 3 && free(toks[j].i, toks[j].e)) {
        run.push(toks[j].t.toLowerCase())
        j++
      }
      const next = toks[j]
      const okRun =
        run.length > 0 &&
        next &&
        isCap(next.t) &&
        free(next.i, next.e) &&
        (run.every((r) => CONNECTORS.has(r)) || (hasOf && run[0] === 'and' && run.slice(1).every((r) => CONNECTORS.has(r)) && run.length > 1))
      if (okRun) {
        if (run.includes('of')) hasOf = true
        end = j
        continue
      }
      // "Calvin cycle", "Hooke's law"
      if (end === k && !STOP.has(first.t.toLowerCase()) && HEAD_NOUNS.has(n.t.toLowerCase())) {
        end++
      }
      break
    }

    let a = k
    while (a <= end && STOP.has(toks[a].t.toLowerCase())) a++
    k = end
    if (a > end) continue
    const from = toks[a]
    const to = toks[end]
    const text = sentence.slice(from.i, to.e)
    const count = end - a + 1
    const lower = from.t.toLowerCase()
    if (count === 1) {
      if (MONTH_SET.has(lower) || DAY_SET.has(lower) || weakWord(lower) || (from.t.length < 3 && !isAcr(from.t))) continue
      if (a === 0 && !isAcr(from.t) && !seen.has(lower)) continue // just a capital at the start of a sentence
    }
    if (!/\p{L}/u.test(text)) continue
    take(text, count === 1 && isAcr(from.t) ? 'acronym' : 'name', from.i)
  }
  return out.sort((x, y) => x.start - y.start)
}
