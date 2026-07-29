'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/request-origin'

export type AuthState = { error: string } | undefined

export async function signUpWithPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/onboarding')
}

export async function signInWithPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signInWithOAuth(provider: 'google' | 'github') {
  const supabase = await createClient()
  const origin = await getRequestOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? 'Unable to start sign-in.')}`)
  }

  redirect(data.url)
}

export async function signInWithGoogle() {
  await signInWithOAuth('google')
}

export async function signInWithGithub() {
  await signInWithOAuth('github')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
