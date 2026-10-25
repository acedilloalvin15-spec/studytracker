'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { GoogleButton, OrDivider } from '@/components/auth/google-button'
import { createClient } from '@/lib/supabase/client'
import { authRedirectUrl, friendlyAuthError } from '@/lib/auth'
import { signupSchema, type SignupValues } from '@/lib/validations'

export function SignupForm() {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
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

  if (sentTo) {
    return (
      <Card className="rounded-2xl text-center">
        <CardHeader className="items-center">
          <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>.
            Click it to activate your account, then come back and log in. If you don&apos;t see it, check your spam folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button variant="outline" className="w-full" onClick={resend} disabled={resending || cooldown > 0}>
            {resending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the email again'}
          </Button>
          <Button className="w-full" render={<Link href="/login" />}>
            Back to log in
          </Button>
        </CardContent>
      </Card>
    )
  }

  const field = (name: keyof SignupValues) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  })

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create your free account</CardTitle>
        <CardDescription>Get organized in under a minute. No credit card needed.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <GoogleButton label="Sign up with Google" />
        <OrDivider />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="fullName" label="Full name" error={errors.fullName?.message}>
            <Input id="fullName" autoComplete="name" placeholder="Maria Santos" className="h-10" {...field('fullName')} {...register('fullName')} />
          </FormField>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" placeholder="you@school.edu" className="h-10" {...field('email')} {...register('email')} />
          </FormField>
          <FormField id="password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
            <Input id="password" type="password" autoComplete="new-password" className="h-10" {...field('password')} {...register('password')} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" className="h-10" {...field('confirmPassword')} {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="h-10" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
