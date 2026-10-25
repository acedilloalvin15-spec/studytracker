'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/form-field'
import { createClient } from '@/lib/supabase/client'
import { authRedirectUrl, friendlyAuthError } from '@/lib/auth'
import { forgotSchema, resetSchema } from '@/lib/validations'
import type { z } from 'zod'

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) })

  async function onSubmit({ email }: z.infer<typeof forgotSchema>) {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/reset-password'),
    })
    if (error && (error.code?.startsWith('over_') || error.status === 429)) {
      toast.error(friendlyAuthError(error))
      return
    }
    setSent(true)
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        {sent && (
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
        )}
        <CardTitle className="text-2xl">{sent ? 'Check your inbox' : 'Forgot your password?'}</CardTitle>
        <CardDescription>
          {sent
            ? 'If an account exists for that email, we sent a link to reset your password.'
            : "Enter your email and we'll send you a link to set a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!sent && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                className="h-10"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
            </FormField>
            <Button type="submit" className="h-10" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Sending link…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </CardContent>
    </Card>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) })

  async function onSubmit({ password }: z.infer<typeof resetSchema>) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(
        error.code === 'session_not_found' || error.status === 401
          ? 'Your reset link has expired. Request a new one.'
          : friendlyAuthError(error),
      )
      return
    }
    toast.success('Password updated. You are all set!')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField id="password" label="New password" error={errors.password?.message} hint="At least 8 characters.">
            <Input id="password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="h-10" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
