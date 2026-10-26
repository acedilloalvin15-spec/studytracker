'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { GoogleButton, OrDivider } from '@/components/auth/google-button'
import { AuthSplitCard } from '@/components/auth/auth-split-card'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError, safeNext } from '@/lib/auth'
import { loginSchema, type LoginValues } from '@/lib/validations'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      toast.error(friendlyAuthError(error))
      return
    }
    toast.success('Welcome back!')
    router.replace(safeNext(params.get('next')))
    router.refresh()
  }

  return (
    <AuthSplitCard
      footer={
        <p>
          New to StudyTrack?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create a free account
          </Link>
        </p>
      }
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-balance text-muted-foreground">
          Log in to see what&apos;s due and what to review today.
        </p>
      </div>

      {params.get('error') === 'auth' && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          That sign-in link is invalid or has expired. Please try again.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@school.edu"
            className="h-11 rounded-full bg-background/70 px-5"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </FormField>
        <FormField
          id="password"
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-normal text-primary hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-11 rounded-full bg-background/70 pr-12 pl-5"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </FormField>
        <Button type="submit" className="mt-1 h-11 w-full rounded-full text-sm font-semibold shadow-sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <OrDivider />

      <div className="[&_button]:h-11 [&_button]:rounded-full [&_button]:bg-background/70">
        <GoogleButton />
      </div>
    </AuthSplitCard>
  )
}
