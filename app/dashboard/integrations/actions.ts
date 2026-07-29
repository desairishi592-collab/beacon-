'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { getRequestOrigin } from '@/lib/request-origin'
import { syncQuickbooksData } from '@/lib/quickbooks/sync'

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
