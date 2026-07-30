export type Field = 'finance' | 'medicine' | 'engineering' | 'other'

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

export type FinancialSnapshot = {
  id: string
  profile_id: string
  period_start: string
  period_end: string
  cash_balance: number
  total_revenue: number
  total_expenses: number
  operating_income: number
  total_debt_service: number
  expense_breakdown: Record<string, number>
  source: string
  created_at: string
}

export type RiskSignalType = 'cash_runway' | 'burn_rate' | 'dscr' | 'expense_concentration' | 'anomaly'

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export type RiskFlag = {
  id: string
  snapshot_id: string
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

export type AlertState = {
  id: string
  risk_flag_id: string
  profile_id: string
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}

export type NotificationPreference = {
  id: string
  profile_id: string
  signal_type: RiskSignalType
  email_enabled: boolean
  created_at: string
  updated_at: string
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

// Schedule-based risk flags (Medicine/Engineering/Other, computed from
// schedule_uploads). Distinct from the financial RiskSignalType/RiskFlag
// above, which are computed from financial_snapshots for Finance.
export type ScheduleRiskSignalType =
  | 'understaffed_shift'
  | 'single_point_of_failure'
  | 'excessive_consecutive_shifts'
  | 'no_rest_violation'
  | 'coverage_gap'

export type ScheduleRiskFlag = {
  id: string
  upload_id: string
  profile_id: string
  signal_type: ScheduleRiskSignalType
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

export type QuickbooksConnection = {
  id: string
  profile_id: string
  realm_id: string
  access_token: string
  refresh_token: string
  access_token_expires_at: string
  refresh_token_expires_at: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type QuickbooksSyncTrigger = 'manual' | 'cron'

export type QuickbooksSyncStatus = 'success' | 'error'

export type QuickbooksSyncRun = {
  id: string
  profile_id: string
  trigger: QuickbooksSyncTrigger
  status: QuickbooksSyncStatus
  snapshots_synced: number
  error_message: string | null
  started_at: string
  finished_at: string
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
      financial_snapshots: {
        Row: FinancialSnapshot
        Insert: {
          id?: string
          profile_id: string
          period_start: string
          period_end: string
          cash_balance: number
          total_revenue: number
          total_expenses: number
          operating_income: number
          total_debt_service?: number
          expense_breakdown?: Record<string, number>
          source?: string
        }
        Update: Partial<{
          period_start: string
          period_end: string
          cash_balance: number
          total_revenue: number
          total_expenses: number
          operating_income: number
          total_debt_service: number
          expense_breakdown: Record<string, number>
          source: string
        }>
        Relationships: []
      }
      risk_flags: {
        Row: RiskFlag
        Insert: {
          id?: string
          snapshot_id: string
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
          title: string
          explanation: string
          recommendation: string
        }>
        Relationships: []
      }
      alert_states: {
        Row: AlertState
        Insert: {
          id?: string
          risk_flag_id: string
          profile_id: string
          read_at?: string | null
          dismissed_at?: string | null
        }
        Update: Partial<{
          read_at: string | null
          dismissed_at: string | null
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
      schedule_risk_flags: {
        Row: ScheduleRiskFlag
        Insert: {
          id?: string
          upload_id: string
          profile_id: string
          signal_type: ScheduleRiskSignalType
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
      quickbooks_connections: {
        Row: QuickbooksConnection
        Insert: {
          id?: string
          profile_id: string
          realm_id: string
          access_token: string
          refresh_token: string
          access_token_expires_at: string
          refresh_token_expires_at: string
          last_synced_at?: string | null
        }
        Update: Partial<{
          realm_id: string
          access_token: string
          refresh_token: string
          access_token_expires_at: string
          refresh_token_expires_at: string
          last_synced_at: string | null
        }>
        Relationships: []
      }
      quickbooks_sync_runs: {
        Row: QuickbooksSyncRun
        Insert: {
          id?: string
          profile_id: string
          trigger: QuickbooksSyncTrigger
          status: QuickbooksSyncStatus
          snapshots_synced?: number
          error_message?: string | null
          started_at: string
          finished_at?: string
        }
        Update: Partial<{
          status: QuickbooksSyncStatus
          snapshots_synced: number
          error_message: string | null
          finished_at: string
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
      notification_preferences: {
        Row: NotificationPreference
        Insert: {
          id?: string
          profile_id: string
          signal_type: RiskSignalType
          email_enabled?: boolean
        }
        Update: Partial<{
          email_enabled: boolean
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
