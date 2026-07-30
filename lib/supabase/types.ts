export type Field = 'medicine'

export type TeamRole = 'admin' | 'member'

export type Profile = {
  id: string
  name: string
  role: string
  field: Field
  team_size: number
  team_id: string
  team_role: TeamRole
  weekly_digest_enabled: boolean
  check_in_reminder_enabled: boolean
  created_at: string
  updated_at: string
}

export type TeamInviteStatus = 'pending' | 'accepted' | 'revoked'

export type TeamInvite = {
  id: string
  inviter_profile_id: string
  invitee_email: string
  status: TeamInviteStatus
  role: TeamRole
  created_at: string
}

export type ManualCheckin = {
  id: string
  profile_id: string
  field: Field
  responses: Record<string, number>
  notes: string | null
  created_at: string
}

export type ScheduleUpload = {
  id: string
  profile_id: string
  filename: string
  row_count: number
  columns: string[]
  preview_rows: Record<string, string>[]
  // Full parsed data (every row, not just the preview) — needed by the risk
  // analysis engine, which reads whatever columns were mapped.
  rows: Record<string, string>[]
  // Concept (e.g. "employee", "date") -> source column header.
  column_mapping: Record<string, string>
  // True when auto-detection couldn't confidently map a required concept
  // and the manager needs to confirm the mapping by hand.
  needs_mapping: boolean
  created_at: string
}

export type RiskSignalType =
  | 'understaffed_shift'
  | 'single_point_of_failure'
  | 'excessive_consecutive_shifts'
  | 'no_rest_violation'
  | 'coverage_gap'

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export type RiskFlag = {
  id: string
  upload_id: string
  profile_id: string
  signal_type: RiskSignalType
  severity: RiskSeverity
  metric_value: number
  threshold_value: number | null
  metric_label: string
  title: string
  explanation: string
  recommendation: string
  raw_signal: Record<string, unknown>
  created_at: string
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13'
  }
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          name: string
          role: string
          field: Field
          team_size: number
          team_id?: string
          team_role?: TeamRole
          weekly_digest_enabled?: boolean
          check_in_reminder_enabled?: boolean
        }
        Update: Partial<{
          name: string
          role: string
          field: Field
          team_size: number
          team_id: string
          team_role: TeamRole
          weekly_digest_enabled: boolean
          check_in_reminder_enabled: boolean
        }>
        Relationships: []
      }
      manual_checkins: {
        Row: ManualCheckin
        Insert: {
          id?: string
          profile_id: string
          field: Field
          responses?: Record<string, number>
          notes?: string | null
        }
        Update: Partial<{
          responses: Record<string, number>
          notes: string | null
        }>
        Relationships: []
      }
      schedule_uploads: {
        Row: ScheduleUpload
        Insert: {
          id?: string
          profile_id: string
          filename: string
          row_count: number
          columns: string[]
          preview_rows?: Record<string, string>[]
          rows?: Record<string, string>[]
          column_mapping?: Record<string, string>
          needs_mapping?: boolean
        }
        Update: Partial<{
          filename: string
          row_count: number
          columns: string[]
          preview_rows: Record<string, string>[]
          rows: Record<string, string>[]
          column_mapping: Record<string, string>
          needs_mapping: boolean
        }>
        Relationships: []
      }
      risk_flags: {
        Row: RiskFlag
        Insert: {
          id?: string
          upload_id: string
          profile_id: string
          signal_type: RiskSignalType
          severity: RiskSeverity
          metric_value: number
          threshold_value?: number | null
          metric_label: string
          title: string
          explanation: string
          recommendation: string
          raw_signal?: Record<string, unknown>
        }
        Update: Partial<{
          severity: RiskSeverity
        }>
        Relationships: []
      }
      team_invites: {
        Row: TeamInvite
        Insert: {
          id?: string
          inviter_profile_id: string
          invitee_email: string
          status?: TeamInviteStatus
          role?: TeamRole
        }
        Update: Partial<{
          status: TeamInviteStatus
        }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
