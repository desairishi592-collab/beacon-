'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { MAX_UPLOAD_BYTES, summarizeScheduleCsv } from '@/lib/schedule-uploads/csv'
import { ALL_CONCEPTS, inferColumnMapping, type ScheduleConcept } from '@/lib/schedule-uploads/column-mapping'
import { analyzeScheduleUpload } from '@/lib/schedule-risk-engine/analyze'
import { getRequestOrigin } from '@/lib/request-origin'
import { syncQuickbooksData } from '@/lib/quickbooks/sync'
import { fetchRepo } from '@/lib/github/repos'
import { syncGithubData } from '@/lib/github/sync'
import { createAdminClient } from '@/lib/supabase/admin'

export type UploadScheduleState =
  | { error: string }
  | { success: true; flagCount: number }
  | {
      needsMapping: true
      uploadId: string
      columns: string[]
      suggestedMapping: Partial<Record<ScheduleConcept, string>>
    }
  | undefined

export async function uploadSchedule(
  _prevState: UploadScheduleState,
  formData: FormData
): Promise<UploadScheduleState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a CSV file to upload.' }
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { error: 'Only .csv files are supported.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is too large (2MB max).' }
  }

  let summary
  try {
    summary = summarizeScheduleCsv(await file.text())
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not read that file.' }
  }

  // Try to map the header automatically before storing anything — if the
  // manager needs to confirm the mapping by hand, we still want to save
  // the parsed data so the mapping step doesn't require a re-upload.
  const { mapping, missingRequired } = inferColumnMapping(summary.columns)
  const needsMapping = missingRequired.length > 0

  const { data: upload, error } = await db
    .from('schedule_uploads')
    .upsert(
      {
        profile_id: userId,
        filename: file.name,
        row_count: summary.rowCount,
        columns: summary.columns,
        preview_rows: summary.previewRows,
        rows: summary.rows,
        column_mapping: mapping,
        needs_mapping: needsMapping,
      },
      { onConflict: 'profile_id' }
    )
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!upload) return { error: 'Could not save the upload.' }

  if (needsMapping) {
    return { needsMapping: true, uploadId: upload.id, columns: summary.columns, suggestedMapping: mapping }
  }

  const flags = await analyzeScheduleUpload(db, upload.id, userId, summary.rows, mapping)

  revalidatePath('/dashboard/settings/integrations')
  revalidatePath('/dashboard/risk-flags')
  return { success: true, flagCount: flags.length }
}

export type ConfirmMappingState = { error: string } | { success: true; flagCount: number } | undefined

// Persists a manager's manual column mapping (used when auto-detection
// couldn't confidently map a required concept) and runs the same risk
// analysis the automatic path runs.
export async function confirmScheduleMapping(
  _prevState: ConfirmMappingState,
  formData: FormData
): Promise<ConfirmMappingState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const uploadId = formData.get('uploadId')
  if (typeof uploadId !== 'string' || !uploadId) return { error: 'Missing upload.' }

  const mapping: Partial<Record<ScheduleConcept, string>> = {}
  for (const concept of ALL_CONCEPTS) {
    const column = formData.get(`mapping_${concept}`)
    if (typeof column === 'string' && column) mapping[concept] = column
  }

  if (!mapping.employee || !mapping.date) {
    return { error: 'Choose a column for both employee and shift date.' }
  }

  const { data: upload, error: fetchError } = await db
    .from('schedule_uploads')
    .select('rows')
    .eq('id', uploadId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (fetchError) return { error: fetchError.message }
  if (!upload) return { error: 'Upload not found.' }

  const { error: updateError } = await db
    .from('schedule_uploads')
    .update({ column_mapping: mapping, needs_mapping: false })
    .eq('id', uploadId)
  if (updateError) return { error: updateError.message }

  const flags = await analyzeScheduleUpload(db, uploadId, userId, upload.rows, mapping)

  revalidatePath('/dashboard/settings/integrations')
  revalidatePath('/dashboard/risk-flags')
  return { success: true, flagCount: flags.length }
}

export type SyncState = { error: string } | { snapshotsSynced: number } | undefined

export async function syncQuickbooks(_prevState: SyncState, _formData: FormData): Promise<SyncState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  try {
    const origin = await getRequestOrigin()
    const result = await syncQuickbooksData(session.userId, origin)
    revalidatePath('/dashboard/settings/integrations')
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

  // quickbooks_connections is service-role-only (see app/dashboard/settings/integrations/page.tsx),
  // so the delete has to go through the admin client — scoped to this profile so a caller
  // can only ever remove their own connection.
  const db = createAdminClient()
  const { error } = await db.from('quickbooks_connections').delete().eq('profile_id', session.userId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings/integrations')
  revalidatePath('/dashboard')
  return { success: true }
}

export type ConnectGithubState =
  | { error: string }
  | { success: true; flagsComputed: number; syncError?: string }
  | undefined

// Saves a GitHub connection from a user-supplied fine-grained Personal
// Access Token plus "owner/repo" — there's no OAuth redirect here (see
// lib/github/client.ts's comment on why: classic GitHub OAuth scopes can't
// express read-only for private repos, only fine-grained PATs and GitHub
// Apps can). The token is validated with a single read-only GET before
// anything is stored, so a bad token or inaccessible repo never gets saved.
export async function connectGithub(
  _prevState: ConnectGithubState,
  formData: FormData
): Promise<ConnectGithubState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const token = String(formData.get('token') ?? '').trim()
  const repoInput = String(formData.get('repo') ?? '').trim()
  if (!token) return { error: 'Paste a fine-grained personal access token.' }

  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repoInput)
  if (!match) return { error: 'Enter the repository as "owner/repo", e.g. "acme/api".' }
  const [, owner, repo] = match

  try {
    await fetchRepo(token, owner, repo)
  } catch {
    return {
      error:
        'Could not read that repository with the given token. Check the token is valid and grants at least read-only access to this repo.',
    }
  }

  // github_connections is service-role-only (holds a bearer token), so the
  // write has to go through the admin client — same pattern as
  // quickbooks_connections.
  const db = createAdminClient()
  const { error } = await db.from('github_connections').upsert(
    { profile_id: session.userId, repo_owner: owner, repo_name: repo, access_token: token },
    { onConflict: 'profile_id' }
  )
  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings/integrations')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/risk-flags')

  // Pull the initial data right away so the dashboard has something to show
  // as soon as connecting finishes. Best-effort — a failure here shouldn't
  // make it look like connecting failed; "Sync now" can retry.
  try {
    const result = await syncGithubData(session.userId)
    return { success: true, flagsComputed: result.flagsComputed }
  } catch (error) {
    return {
      success: true,
      flagsComputed: 0,
      syncError: error instanceof Error ? error.message : 'Connected, but the initial sync failed.',
    }
  }
}

export type SyncGithubState = { error: string } | { flagsComputed: number } | undefined

export async function syncGithub(_prevState: SyncGithubState, _formData: FormData): Promise<SyncGithubState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  try {
    const result = await syncGithubData(session.userId)
    revalidatePath('/dashboard/settings/integrations')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/risk-flags')
    return { flagsComputed: result.flagsComputed }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sync failed.' }
  }
}

export type DisconnectGithubState = { error: string } | { success: true } | undefined

export async function disconnectGithub(
  _prevState: DisconnectGithubState,
  _formData: FormData
): Promise<DisconnectGithubState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const db = createAdminClient()
  const { error } = await db.from('github_connections').delete().eq('profile_id', session.userId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings/integrations')
  revalidatePath('/dashboard')
  return { success: true }
}
