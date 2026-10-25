import type { AuthError } from '@supabase/supabase-js'

export function authRedirectUrl(next?: string) {
  const base =
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`
  if (!next) return base
  const url = new URL(base)
  url.searchParams.set('next', next)
  return url.toString()
}

export function friendlyAuthError(error: AuthError): string {
  const code = error.code ?? ''
  if (code === 'invalid_credentials' || code === 'user_not_found' || code === 'user_already_exists') {
    return 'Invalid email or password.'
  }
  if (code === 'email_not_confirmed') {
    return 'Please confirm your email first. Check your inbox for the confirmation link.'
  }
  if (code === 'weak_password') return 'That password is too weak. Try a longer one.'
  if (code === 'same_password') return 'Your new password must be different from the old one.'
  if (code.startsWith('over_') || error.status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (code === 'email_address_invalid') return 'That email address is not allowed.'
  return 'Something went wrong. Please try again.'
}

export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}
