'use client'

import { useSyncExternalStore } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { readOffline, saveOffline } from '@/lib/offline'

/*
 * Offline-friendly saving.
 * - Online: changes are saved to Supabase right away.
 * - Offline (or a very slow connection): changes are saved on the device, shown immediately,
 *   put in a waiting list, and sent to Supabase in order when the connection comes back.
 * New items get their ID on the device, so sending the same change twice never makes duplicates.
 */

export type TableName = 'subjects' | 'tasks' | 'classes' | 'exams' | 'review_sessions'
export type Row = { id: string } & Record<string, unknown>
export type QueueOp =
  | { kind: 'insert'; table: TableName; row: Row }
  | { kind: 'update'; table: TableName; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; table: TableName; id: string }
  | { kind: 'clearPlan'; fromDate: string }
export type WriteResult = 'synced' | 'queued' | 'failed'

const QUEUE_KEY = 'studytrack-offline:__queue'
const QUEUE_EVENT = 'studytrack-queue-changed'
const ONLINE_TIMEOUT_MS = 10_000
const FLUSH_TIMEOUT_MS = 20_000
const TABLES: TableName[] = ['subjects', 'tasks', 'classes', 'exams', 'review_sessions']
const SORT_KEY: Record<TableName, string> = {
  subjects: 'name',
  tasks: 'due_at',
  classes: 'start_time',
  exams: 'exam_date',
  review_sessions: 'session_date',
}
const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  tasks: { is_completed: false, completed_at: null },
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })
}

/* ---------- the waiting list ---------- */

function getQueue(): QueueOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueueOp[]) : []
  } catch {
    return []
  }
}

function setQueue(queue: QueueOp[]) {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Storage full or blocked.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

export function pendingCount() {
  return getQueue().length
}

function subscribe(onChange: () => void) {
  window.addEventListener(QUEUE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(QUEUE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** How many changes are still waiting to be sent. */
export function usePendingCount() {
  return useSyncExternalStore(subscribe, () => getQueue().length, () => 0)
}

/* ---------- showing changes on screen right away ---------- */

function opTables(op: QueueOp): TableName[] {
  switch (op.kind) {
    case 'clearPlan':
      return ['review_sessions']
    case 'delete':
      if (op.table === 'subjects') return [...TABLES]
      if (op.table === 'exams') return ['exams', 'review_sessions']
      return [op.table]
    default:
      return [op.table]
  }
}

function sortRows(table: TableName, rows: Row[]): Row[] {
  const key = SORT_KEY[table]
  return [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')))
}

function applyOp(op: QueueOp, table: TableName, rows: Row[]): Row[] {
  switch (op.kind) {
    case 'insert':
      if (op.table !== table || rows.some((r) => r.id === op.row.id)) return rows
      return [...rows, op.row]
    case 'update':
      if (op.table !== table) return rows
      return rows.map((r) => (r.id === op.id ? { ...r, ...op.patch } : r))
    case 'delete': {
      if (op.table === table) return rows.filter((r) => r.id !== op.id)
      // Same clean-up the database does: a deleted subject takes its classes, exams and sessions with it.
      if (op.table === 'subjects') {
        if (table === 'tasks') return rows.map((r) => (r.subject_id === op.id ? { ...r, subject_id: null } : r))
        return rows.filter((r) => r.subject_id !== op.id)
      }
      if (op.table === 'exams' && table === 'review_sessions') return rows.filter((r) => r.exam_id !== op.id)
      return rows
    }
    case 'clearPlan':
      if (table !== 'review_sessions') return rows
      return rows.filter((r) => !(r.is_done === false && String(r.session_date ?? '') >= op.fromDate))
  }
}

function applyLocal(ops: QueueOp[]) {
  const tables = new Set<TableName>(ops.flatMap(opTables))
  tables.forEach((table) => {
    mutate<Row[]>(
      table,
      (current) => {
        const base = current ?? readOffline<Row[]>(table) ?? []
        const next = sortRows(table, ops.reduce((rows, op) => applyOp(op, table, rows), base))
        saveOffline(table, next)
        return next
      },
      { revalidate: false },
    )
  })
}

/** Adds the changes that have not been sent yet to rows that were just loaded from the server. */
export function applyPending<T>(table: string, rows: T[]): T[] {
  if (!(TABLES as string[]).includes(table)) return rows
  const t = table as TableName
  const relevant = getQueue().filter((op) => opTables(op).includes(t))
  if (!relevant.length) return rows
  const merged = relevant.reduce((acc, op) => applyOp(op, t, acc), rows as unknown as Row[])
  return sortRows(t, merged) as unknown as T[]
}

/* ---------- sending to Supabase ---------- */

type Res = { error: { message: string; code?: string } | null; status?: number }

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function exec(op: QueueOp): PromiseLike<unknown> {
  const supabase = createClient()
  switch (op.kind) {
    case 'insert':
      return supabase.from(op.table).insert(op.row)
    case 'update':
      return supabase.from(op.table).update(op.patch).eq('id', op.id)
    case 'delete':
      return supabase.from(op.table).delete().eq('id', op.id)
    case 'clearPlan':
      return supabase.from('review_sessions').delete().eq('is_done', false).gte('session_date', op.fromDate)
  }
}

/** ok = saved, network = no connection (try later), rejected = the server refused it. */
async function runOp(op: QueueOp, timeoutMs: number): Promise<'ok' | 'network' | 'rejected'> {
  let res: Res
  try {
    res = (await withTimeout(exec(op), timeoutMs)) as Res
  } catch {
    return 'network'
  }
  const { error, status } = res
  if (!error) return 'ok'
  if (status === 0 || /fetch|network|timeout|load failed/i.test(error.message)) return 'network'
  if (op.kind === 'insert' && error.code === '23505') return 'ok' // already saved earlier
  return 'rejected'
}

function revalidate(tables: TableName[]) {
  return Promise.all(tables.map((t) => mutate(t)))
}

let flushing = false

async function drainQueue(): Promise<{ done: number; dropped: number }> {
  let done = 0
  let dropped = 0
  for (;;) {
    const queue = getQueue()
    if (!queue.length) break
    const result = await runOp(queue[0], FLUSH_TIMEOUT_MS)
    if (result === 'network') break
    setQueue(getQueue().slice(1))
    if (result === 'ok') done++
    else {
      dropped++
      console.warn('A change could not be saved and was skipped:', queue[0])
    }
  }
  if (done || dropped) await revalidate(TABLES)
  return { done, dropped }
}

/** Sends waiting changes in order. Stops when the connection is gone and tries again later. */
export async function flushQueue(): Promise<{ done: number; dropped: number }> {
  if (flushing || !isOnline()) return { done: 0, dropped: 0 }
  flushing = true
  try {
    // The lock makes sure only one tab or window sends the waiting list at a time.
    if ('locks' in navigator) return await navigator.locks.request('studytrack-flush', () => drainQueue())
    return await drainQueue()
  } finally {
    flushing = false
  }
}

/* ---------- what the screens call ---------- */

/** Puts several changes on the waiting list at once (used by the review plan). */
export function enqueueOps(ops: QueueOp[]) {
  setQueue([...getQueue(), ...ops])
  applyLocal(ops)
  if (isOnline()) void flushQueue()
}

async function writeOp(op: QueueOp, optimistic = false): Promise<WriteResult> {
  let shown = false
  if (optimistic) {
    applyLocal([op])
    shown = true
  }
  if (isOnline() && getQueue().length === 0) {
    const result = await runOp(op, ONLINE_TIMEOUT_MS)
    if (result === 'ok') {
      await revalidate(opTables(op))
      return 'synced'
    }
    if (result === 'rejected') {
      if (shown) await revalidate(opTables(op))
      return 'failed'
    }
  }
  setQueue([...getQueue(), op])
  if (!shown) applyLocal([op])
  if (isOnline()) void flushQueue()
  return 'queued'
}

export function insertRow(table: TableName, values: Record<string, unknown>): Promise<WriteResult> {
  const row: Row = {
    ...(DEFAULTS[table] ?? {}),
    ...values,
    id: newId(),
    created_at: new Date().toISOString(),
  }
  return writeOp({ kind: 'insert', table, row })
}

export function updateRow(
  table: TableName,
  id: string,
  patch: Record<string, unknown>,
  options?: { optimistic?: boolean },
): Promise<WriteResult> {
  return writeOp({ kind: 'update', table, id, patch }, options?.optimistic)
}

export function deleteRow(table: TableName, id: string): Promise<WriteResult> {
  return writeOp({ kind: 'delete', table, id }, true)
}
