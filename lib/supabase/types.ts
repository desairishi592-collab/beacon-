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
