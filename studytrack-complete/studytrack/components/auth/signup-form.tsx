'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { GoogleButton, OrDivider } from '@/components/auth/google-button'
import { AuthSplitCard } from '@/components/auth/auth-split-card'
import { createClient } from '@/lib/supabase/client'
import { authRedirectUrl, friendlyAuthError } from '@/lib/auth'
import { signupSchema, type SignupValues } from '@/lib/validations'

export function SignupForm() {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function resend() {
    if (!sentTo) return
    setResending(true)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: authRedirectUrl() },
    })
    setResending(false)
    if (error) {
      toast.error(friendlyAuthError(error))
      return
    }
    toast.success('Confirmation email sent again')
    setCooldown(60)
  }

  async function onSubmit(values: SignupValues) {
    // Early check: catches typos, temporary inboxes, and domains that cannot receive email.
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })
      if (res.ok) {
        const result = (await res.json()) as { ok: boolean; message?: string }
        if (!result.ok) {
          setError('email', { type: 'validate', message: result.message ?? 'Please use a real email address.' })
          return
        }
      }
    } catch {
      // If the check cannot run, the confirmation email below still protects the site.
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: { full_name: values.fullName },
      },
    })
    if (error) {
      toast.error(
        error.code === 'user_already_exists'
          ? 'Could not create the account. Try logging in instead.'
          : friendlyAuthError(error),
      )
      return
    }
    if (data.session) {
      toast.success('Account created!')
      router.replace('/dashboard')
      router.refresh()
      return
    }
    setSentTo(values.email)
  }

  const footer = (
    <p>
      Already have an account?{' '}
      <Link href="/login" className="font-medium text-primary hover:underline">
        Log in
      </Link>
    </p>
  )

  if (sentTo) {
    return (
      <AuthSplitCard footer={footer}>
        <div className="text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-1.5 text-sm text-balance text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>.
            Click it to activate your account, then come back and log in. If you don&apos;t see it, check your spam folder.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button variant="outline" className="h-11 w-full rounded-full" onClick={resend} disabled={resending || cooldown > 0}>
            {resending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the email again'}
          </Button>
          <Button className="h-11 w-full rounded-full font-semibold" render={<Link href="/login" />}>
            Back to log in
          </Button>
        </div>
      </AuthSplitCard>
    )
  }

  const field = (name: keyof SignupValues) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  })
  const pill = 'h-11 rounded-full bg-background/70 px-5'

  return (
    <AuthSplitCard footer={footer}>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your free account</h1>
        <p className="mt-1.5 text-sm text-balance text-muted-foreground">
          Get organized in under a minute. No credit card needed.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField id="fullName" label="Full name" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" placeholder="Maria Santos" className={pill} {...field('fullName')} {...register('fullName')} />
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@school.edu" className={pill} {...field('email')} {...register('email')} />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`${pill} pr-12`}
              {...field('password')}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className={pill}
            {...field('confirmPassword')}
            {...register('confirmPassword')}
          />
        </FormField>
        <Button type="submit" className="mt-1 h-11 w-full rounded-full text-sm font-semibold shadow-sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <OrDivider />

      <div className="[&_button]:h-11 [&_button]:rounded-full [&_button]:bg-background/70">
        <GoogleButton label="Sign up with Google" />
      </div>
    </AuthSplitCard>
  )
}
