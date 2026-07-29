'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { MAX_UPLOAD_BYTES, summarizeScheduleCsv } from '@/lib/schedule-uploads/csv'

export type UploadScheduleState = { error: string } | { success: true } | undefined

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

  const { error } = await db.from('schedule_uploads').upsert(
    {
      profile_id: userId,
      filename: file.name,
      row_count: summary.rowCount,
      columns: summary.columns,
      preview_rows: summary.previewRows,
    },
    { onConflict: 'profile_id' }
  )
  if (error) return { error: error.message }

  revalidatePath('/dashboard/integrations')
  return { success: true }
}
