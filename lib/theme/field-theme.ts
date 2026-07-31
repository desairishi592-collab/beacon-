import type { Field } from '@/lib/supabase/types'

// Maps a profile's field to its accent theme class (see the .theme-* rules
// in app/globals.css). 'other' and unset fields fall through to no class,
// which resolves to the default black/gray tokens defined on :root — the
// same pre-field treatment used on login/landing/onboarding.
const FIELD_THEME_CLASS: Partial<Record<Field, string>> = {
  finance: 'theme-finance',
  engineering: 'theme-engineering',
  medicine: 'theme-medicine',
}

export function getFieldThemeClass(field?: Field | null): string {
  return (field && FIELD_THEME_CLASS[field]) || ''
}
