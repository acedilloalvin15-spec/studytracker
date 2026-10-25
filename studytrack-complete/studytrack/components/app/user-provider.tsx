'use client'

import { createContext, useContext } from 'react'
import { useProfile } from '@/hooks/use-study-data'
import type { Profile } from '@/lib/types'

type UserContextValue = { userId: string; email: string; initialProfile: Profile }

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ value, children }: { value: UserContextValue; children: React.ReactNode }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useCurrentUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used inside UserProvider')
  const { data: profile, mutate } = useProfile(ctx.userId, ctx.initialProfile)
  return { userId: ctx.userId, email: ctx.email, profile: profile ?? ctx.initialProfile, mutateProfile: mutate }
}

export function initials(name: string | null | undefined, fallback = '?') {
  if (!name) return fallback
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
