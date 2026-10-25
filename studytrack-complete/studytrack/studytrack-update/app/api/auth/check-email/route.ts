import { NextResponse } from 'next/server'
import { promises as dns } from 'node:dns'

export const runtime = 'nodejs'

// Common throw-away inbox services. This list is a start, not complete.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com',
  'yopmail.com', 'yopmail.net', 'trashmail.com', 'trashmail.net', 'getnada.com', 'nada.email',
  'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com',
  'mintemail.com', 'spamgourmet.com', 'mailnesia.com', 'mytemp.email', 'burnermail.io', 'moakt.com',
  'tempinbox.com', 'inboxkitten.com', 'mailcatch.com', 'discard.email', 'harakirimail.com',
])

// Typos of popular providers that people make by accident.
const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.cm': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com',
}

// Big providers we already know receive email, so a lookup problem can never block them.
const KNOWN_GOOD = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.ph', 'ymail.com', 'outlook.com', 'outlook.ph', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
])

const NO_RECORDS = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN'])

function reply(ok: boolean, message?: string) {
  return NextResponse.json({ ok, message })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))])
}

export async function POST(request: Request) {
  let email = ''
  try {
    const body = (await request.json()) as { email?: unknown }
    email = String(body.email ?? '').trim().toLowerCase()
  } catch {
    return reply(false, 'Enter a valid email address.')
  }

  const match = /^[^\s@]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/.exec(email)
  if (!match || email.length > 254) return reply(false, 'Enter a valid email address.')
  const domain = match[1]

  if (TYPOS[domain]) return reply(false, `Did you mean ${email.split('@')[0]}@${TYPOS[domain]}?`)
  if (DISPOSABLE.has(domain)) return reply(false, 'Please use your real email address, not a temporary inbox.')

  if (KNOWN_GOOD.has(domain)) return reply(true)

  try {
    const mx = await withTimeout(dns.resolveMx(domain), 3000)
    // A single "." record means the domain says it does not accept email.
    const real = mx.filter((r) => r.exchange && r.exchange !== '.')
    if (real.length > 0) return reply(true)
    return reply(false, 'That email domain cannot receive email. Please check the spelling.')
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    if (NO_RECORDS.has(code)) {
      // Some domains have no MX record but still accept mail on their main address.
      try {
        const a = await withTimeout(dns.resolve4(domain), 3000)
        if (a.length > 0) return reply(true)
      } catch {
        // Fall through: the domain does not exist.
      }
      return reply(false, 'That email domain does not exist. Please check the spelling.')
    }
    // Could not check right now (network or DNS problem): do not block the student.
    return reply(true)
  }
}
