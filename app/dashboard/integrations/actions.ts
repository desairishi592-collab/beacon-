'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { MAX_UPLOAD_BYTES, summarizeScheduleCsv } from '@/lib/schedule-uploads/csv'
import { ALL_CONCEPTS, inferColumnMapping, type ScheduleConcept } from '@/lib/schedule-uploads/column-mapping'
import { analyzeScheduleUpload } from '@/lib/risk-engine/analyze'

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

  revalidatePath('/dashboard/integrations')
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

  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard/risk-flags')
  return { success: true, flagCount: flags.length }
}
