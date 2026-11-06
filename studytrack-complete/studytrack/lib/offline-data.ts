'use client'

import { createClient } from '@/lib/supabase/client'
import { getOfflineOwner, readOffline, saveOffline } from '@/lib/offline'
import { readQueue } from '@/lib/offline-queue'
import { applyOps, sortRows, type Row } from '@/lib/offline-ops'

function looksLikeNetworkError(message: string | undefined) {
  return /fetch|network|failed to load|timeout|offline/i.test(message ?? '')
}

/**
 * Loads a table. Online: from the server, plus any changes still waiting to be sent.
 * Offline: from the copy saved on the phone, plus the changes made offline.
 */
export async function fetchTableRows<T>(table: string, order: string, ascending = true): Promise<T[]> {
  let rows: Row[] | null = null

  if (navigator.onLine) {
    const { data, error } = await createClient().from(table).select('*').order(order, { ascending })
    if (!error) {
      rows = (data ?? []) as Row[]
      saveOffline(table, rows)
    } else if (!looksLikeNetworkError(error.message)) {
      throw error
    }
  }

  if (!rows) {
    rows = readOffline<Row[]>(table)
    if (!rows) throw new Error('You are offline and this has not been saved on your phone yet.')
  }

  const ops = readQueue()
  if (ops.length === 0) return rows as T[]
  return sortRows(applyOps(table, rows, ops, getOfflineOwner()), order, ascending) as T[]
}
