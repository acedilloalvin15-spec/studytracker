'use client'

import { toast } from 'sonner'
import { mutate } from 'swr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueuedOp } from '@/lib/offline-ops'

// Changes made without internet wait here (in the phone's storage) and are sent when the connection returns.
export const QUEUE_KEY = 'studytrack-offline-queue'
const QUEUE_EVENT = 'studytrack:queue'
export const QUEUEABLE_TABLES = ['tasks', 'subjects', 'classes', 'exams', 'review_sessions', 'reviewers']

export function readQueue(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedOp[]
  } catch {
    return []
  }
}

function writeQueue(ops: QueuedOp[]) {
  try {
    if (ops.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Storage full: the change is kept only for this session.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

export function subscribeQueue(onChange: () => void) {
  window.addEventListener(QUEUE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(QUEUE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

let cachedRaw = ''
let cachedCount = 0
export function pendingCountSnapshot() {
  const raw = localStorage.getItem(QUEUE_KEY) ?? ''
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedCount = readQueue().length
  }
  return cachedCount
}

let queuedWrites = 0

export function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
}

/**
 * Used by the database client. Online, writes go straight through. Offline (or while older
 * changes are still waiting), they are saved and the app carries on as if they worked.
 */
export async function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (typeof input !== 'string' && !(input instanceof URL)) return fetch(input, init)

  const url = new URL(String(input), window.location.href)
  const table = /\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1]
  if (!table || !QUEUEABLE_TABLES.includes(table) || !['POST', 'PATCH', 'DELETE'].includes(method)) {
    return fetch(input, init)
  }

  // New rows get their id here, so later offline changes can point at them.
  let body: unknown = null
  if (typeof init?.body === 'string' && init.body) {
    body = JSON.parse(init.body)
    if (method === 'POST') {
      const items = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[]
      items.forEach((item) => {
        if (!item.id) item.id = newId()
      })
      const columns = url.searchParams.get('columns')
      if (columns !== null && !columns.includes('"id"')) url.searchParams.set('columns', `${columns},"id"`)
    }
  }
  const sendInit: RequestInit = { ...init, body: body === null ? init?.body : JSON.stringify(body) }

  if (navigator.onLine && readQueue().length === 0) {
    try {
      return await fetch(url.toString(), sendInit)
    } catch {
      // The connection dropped: save the change instead.
    }
  }

  const query = url.searchParams.toString()
  queuedWrites++
  writeQueue([
    ...readQueue(),
    { id: newId(), method: method as QueuedOp['method'], table, query, body, createdAt: Date.now() },
  ])
  if (navigator.onLine) void flushQueue()
  return new Response(null, { status: method === 'POST' ? 201 : 204 })
}

let flushing = false

/** Sends the saved changes, oldest first. Safe to call at any time. */
export async function flushQueue() {
  if (flushing || typeof window === 'undefined' || !navigator.onLine || readQueue().length === 0) return
  flushing = true
  let sent = 0
  let dropped = 0
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const { data } = await createClient().auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    for (;;) {
      const [op] = readQueue()
      if (!op) break
      let res: Response
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${op.table}${op.query ? `?${op.query}` : ''}`, {
          method: op.method,
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: op.body == null ? undefined : JSON.stringify(op.body),
        })
      } catch {
        break // Still no connection: try again later.
      }
      if (res.status === 401 || res.status >= 500) break // Try again later.
      if (res.ok || (op.method === 'POST' && res.status === 409)) sent++
      else dropped++ // The server refused it (for example, the item was deleted elsewhere).
      writeQueue(readQueue().filter((q) => q.id !== op.id))
    }
  } finally {
    flushing = false
  }

  if (sent + dropped > 0) {
    QUEUEABLE_TABLES.forEach((t) => mutate(t))
    if (sent > 0) toast.success(`${sent} change${sent === 1 ? '' : 's'} saved online`)
    if (dropped > 0) toast.error(`${dropped} change${dropped === 1 ? '' : 's'} made offline could not be saved`)
  }
}

/* ---------- helpers the screens call ---------- */

export type TableName = 'subjects' | 'tasks' | 'classes' | 'exams' | 'review_sessions'
/** synced = saved online, queued = saved on this device and sent later, failed = refused. */
export type WriteResult = 'synced' | 'queued' | 'failed'

async function write(
  table: TableName,
  run: (t: ReturnType<SupabaseClient['from']>) => PromiseLike<{ error: unknown }>,
): Promise<WriteResult> {
  // Imported here (not at the top) because the database client itself imports this file.
  const { createClient } = await import('@/lib/supabase/client')
  const before = queuedWrites
  let failed = false
  try {
    const { error } = await run(createClient().from(table))
    failed = !!error
  } catch {
    failed = true
  }
  if (failed) return 'failed'
  // Deleting a subject or exam also changes the lists that depend on it, so refresh every list.
  const result: WriteResult = queuedWrites > before ? 'queued' : 'synced'
  await Promise.all(QUEUEABLE_TABLES.map((t) => mutate(t)))
  return result
}

export function insertRow(table: TableName, values: Record<string, unknown>): Promise<WriteResult> {
  return write(table, (t) => t.insert(values))
}

export function updateRow(table: TableName, id: string, patch: Record<string, unknown>): Promise<WriteResult> {
  return write(table, (t) => t.update(patch).eq('id', id))
}

export function deleteRow(table: TableName, id: string): Promise<WriteResult> {
  return write(table, (t) => t.delete().eq('id', id))
}
