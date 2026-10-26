'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { GoogleButton, OrDivider } from '@/components/auth/google-button'
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
    <Card className="rounded-2xl border-border/60 bg-card/95 shadow-xl backdrop-blur">
      <CardHeader className="gap-1.5 pb-2">
        <CardTitle className="text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
        <CardDescription className="text-balance">
          Log in to see what&apos;s due and what to review today.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {params.get('error') === 'auth' && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That sign-in link is invalid or has expired. Please try again.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              className="h-11"
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
                className="h-11 pr-11"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </FormField>
          <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <OrDivider />

        <GoogleButton />

        <p className="text-center text-sm text-muted-foreground">
          New to StudyTrack?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create a free account
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
