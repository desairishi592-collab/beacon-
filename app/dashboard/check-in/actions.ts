'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { getCheckInQuestions, RATING_SCALE } from '@/lib/check-ins/questions'
import { notifySevereCheckin } from '@/lib/notifications/check-in-email'
import { getRequestOrigin } from '@/lib/request-origin'

export type CheckInState = { error: string } | { success: true } | undefined

const VALID_RATINGS = new Set<number>(RATING_SCALE.map((r) => r.value))

export async function submitCheckIn(
  _prevState: CheckInState,
  formData: FormData
): Promise<CheckInState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  if (!profile) return { error: 'Complete onboarding before checking in.' }

  const questions = getCheckInQuestions()
  const responses: Record<string, number> = {}
  for (const question of questions) {
    const raw = Number(formData.get(question.id))
    if (!VALID_RATINGS.has(raw)) {
      return { error: 'Please answer every question.' }
    }
    responses[question.id] = raw
  }

  const notes = String(formData.get('notes') ?? '').trim()

  const { error } = await db.from('manual_checkins').insert({
    profile_id: userId,
    field: profile.field,
    responses,
    notes: notes || null,
  })

  if (error) {
    return { error: error.message }
  }

  await notifySevereCheckin(
    { profileId: userId, responses, notes: notes || null },
    await getRequestOrigin()
  )

  revalidatePath('/dashboard/check-in')
  revalidatePath('/dashboard')
  return { success: true }
}
