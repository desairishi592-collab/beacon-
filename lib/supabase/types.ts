export type Field = 'finance' | 'medicine' | 'engineering' | 'other'

export type Profile = {
  id: string
  name: string
  role: string
  field: Field
  team_size: number
  created_at: string
  updated_at: string
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
        }
        Update: Partial<{
          name: string
          role: string
          field: Field
          team_size: number
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
