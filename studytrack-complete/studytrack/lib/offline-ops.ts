// Pure helpers (no browser code) that show what the data will look like once
// the changes saved while offline have been sent to the server.

export type Row = Record<string, unknown>

export type QueuedOp = {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  table: string
  query: string // the URL query string, for example "id=eq.123"
  body: unknown
  createdAt: number
}

// Values the database fills in by itself, so the offline copy looks the same.
const DEFAULTS: Record<string, Row> = {
  tasks: { notes: null, subject_id: null, priority: 'medium', is_completed: false, completed_at: null },
  subjects: { teacher: null, color: '#4f46e5' },
  classes: { room: null },
  exams: { title: null },
  review_sessions: { is_done: false },
  reviewers: { subject_id: null, source_name: null },
}

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

export function parseFilters(query: string): [string, string][] {
  const out: [string, string][] = []
  new URLSearchParams(query).forEach((value, key) => {
    if (!NOT_FILTERS.has(key)) out.push([key, value])
  })
  return out
}

function compare(a: unknown, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (a !== null && a !== '' && Number.isFinite(na) && b !== '' && Number.isFinite(nb)) return na - nb
  const sa = String(a)
  return sa < b ? -1 : sa > b ? 1 : 0
}

export function matches(row: Row, filters: [string, string][]): boolean {
  return filters.every(([col, spec]) => {
    const dot = spec.indexOf('.')
    if (dot < 0) return false
    const op = spec.slice(0, dot)
    const val = spec.slice(dot + 1)
    const v = row[col]
    switch (op) {
      case 'eq':
        return String(v) === val
      case 'neq':
        return String(v) !== val
      case 'in':
        return val
          .replace(/^\(|\)$/g, '')
          .split(',')
          .map((s) => s.replace(/^"|"$/g, ''))
          .includes(String(v))
      case 'gt':
        return v != null && compare(v, val) > 0
      case 'gte':
        return v != null && compare(v, val) >= 0
      case 'lt':
        return v != null && compare(v, val) < 0
      case 'lte':
        return v != null && compare(v, val) <= 0
      case 'is':
        return val === 'null' ? v == null : String(v) === val
      default:
        return false
    }
  })
}

function idsDeleted(ops: QueuedOp[], table: string): Set<string> {
  const ids = new Set<string>()
  for (const op of ops) {
    if (op.table !== table || op.method !== 'DELETE') continue
    for (const [col, spec] of parseFilters(op.query)) {
      if (col !== 'id') continue
      if (spec.startsWith('eq.')) ids.add(spec.slice(3))
      else if (spec.startsWith('in.')) {
        spec
          .slice(3)
          .replace(/^\(|\)$/g, '')
          .split(',')
          .forEach((s) => ids.add(s.replace(/^"|"$/g, '')))
      }
    }
  }
  return ids
}

export function applyOps(table: string, serverRows: Row[], ops: QueuedOp[], ownerId: string | null): Row[] {
  let rows = serverRows.map((r) => ({ ...r }))

  for (const op of ops) {
    if (op.table !== table) continue
    const filters = parseFilters(op.query)
    if (op.method === 'POST') {
      const items = (Array.isArray(op.body) ? op.body : [op.body]) as Row[]
      for (const item of items) {
        rows.push({
          ...DEFAULTS[table],
          user_id: ownerId,
          created_at: new Date(op.createdAt).toISOString(),
          ...item,
        })
      }
    } else if (op.method === 'PATCH') {
      rows = rows.map((r) => (matches(r, filters) ? { ...r, ...(op.body as Row) } : r))
    } else if (op.method === 'DELETE') {
      rows = rows.filter((r) => !matches(r, filters))
    }
  }

  // The same clean-up the database does when a subject or an exam is deleted.
  const goneSubjects = idsDeleted(ops, 'subjects')
  const goneExams = idsDeleted(ops, 'exams')
  if (goneSubjects.size) {
    if (table === 'tasks' || table === 'reviewers') rows = rows.map((r) => (goneSubjects.has(String(r.subject_id)) ? { ...r, subject_id: null } : r))
    if (table === 'classes' || table === 'exams' || table === 'review_sessions') {
      rows = rows.filter((r) => !goneSubjects.has(String(r.subject_id)))
    }
  }
  if (goneExams.size && table === 'review_sessions') {
    rows = rows.filter((r) => !goneExams.has(String(r.exam_id)))
  }
  return rows
}

export function sortRows(rows: Row[], column: string, ascending = true): Row[] {
  const dir = ascending ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[column]
    const y = b[column]
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (x < y ? -1 : x > y ? 1 : 0) * dir
  })
}
