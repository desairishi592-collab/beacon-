import type { RiskSeverity } from '@/lib/supabase/types'

export const SEVERITY_ORDER: RiskSeverity[] = ['critical', 'high', 'medium', 'low']

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

// months of cash runway -> a human-readable "about N days/months" string.
// 30.4368 matches AVG_DAYS_PER_MONTH in lib/risk-engine/signals.ts.
export function formatRunway(months: number): string {
  if (months <= 0) return 'no cash cushion left'
  if (months < 1) {
    const days = Math.round(months * 30.4368)
    return `about ${days} day${days === 1 ? '' : 's'} of cash left`
  }
  return `about ${months.toFixed(1)} month${months === 1 ? '' : 's'} of cash left`
}
