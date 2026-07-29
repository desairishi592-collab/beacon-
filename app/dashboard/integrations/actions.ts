'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { getRequestOrigin } from '@/lib/request-origin'
import { syncQuickbooksData } from '@/lib/quickbooks/sync'
import { createAdminClient } from '@/lib/supabase/admin'

export type SyncState = { error: string } | { snapshotsSynced: number } | undefined

export async function syncQuickbooks(_prevState: SyncState, _formData: FormData): Promise<SyncState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  try {
    const origin = await getRequestOrigin()
    const result = await syncQuickbooksData(session.userId, origin)
    revalidatePath('/dashboard/integrations')
    revalidatePath('/dashboard')
    return { snapshotsSynced: result.snapshotsSynced }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sync failed.' }
  }
}

export type DisconnectState = { error: string } | { success: true } | undefined

export async function disconnectQuickbooks(
  _prevState: DisconnectState,
  _formData: FormData
): Promise<DisconnectState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  // quickbooks_connections is service-role-only (see app/dashboard/integrations/page.tsx),
  // so the delete has to go through the admin client — scoped to this profile so a caller
  // can only ever remove their own connection.
  const db = createAdminClient()
  const { error } = await db.from('quickbooks_connections').delete().eq('profile_id', session.userId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard')
  return { success: true }
}
