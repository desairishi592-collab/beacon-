'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ManualCheckin } from '@/lib/supabase/types'
import type { CheckInQuestion } from '@/lib/check-ins/questions'
import { RATING_SCALE } from '@/lib/check-ins/questions'
import { overallSeverity, severityBand, type SeverityBand } from '@/lib/check-ins/severity'
import { recurringRiskAreas, severityTrend, type RecurringRiskArea } from '@/lib/check-ins/trends'

const RATING_LABEL = new Map<number, string>(RATING_SCALE.map((r) => [r.value, r.label]))

// Same red/amber/green bands as SeverityBadge in check-in-history.tsx, reused
// here for chart points, the legend, and summary cards so this view reads
// consistently with the history list beneath it.
const BAND_FILL: Record<SeverityBand, string> = {
  severe: 'fill-red-600 dark:fill-red-400',
  moderate: 'fill-amber-600 dark:fill-amber-400',
  low: 'fill-green-600 dark:fill-green-400',
}
const BAND_DOT: Record<SeverityBand, string> = {
  severe: 'bg-red-600 dark:bg-red-400',
  moderate: 'bg-amber-600 dark:bg-amber-400',
  low: 'bg-green-600 dark:bg-green-400',
}
const BAND_TEXT: Record<SeverityBand, string> = {
  severe: 'text-red-600 dark:text-red-400',
  moderate: 'text-amber-600 dark:text-amber-400',
  low: 'text-green-600 dark:text-green-400',
}
const BAND_LABEL: Record<SeverityBand, string> = {
  severe: 'Severe',
  moderate: 'Moderate',
  low: 'Low concern',
}
const BANDS: SeverityBand[] = ['low', 'moderate', 'severe']

function formatShortDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLongDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const VBW = 640
const VBH = 220
const MARGIN = { top: 16, right: 16, bottom: 28, left: 28 }
const PLOT_W = VBW - MARGIN.left - MARGIN.right
const PLOT_H = VBH - MARGIN.top - MARGIN.bottom
const Y_MIN = 1
const Y_MAX = 5

// Plots the worst (max) rating from each check-in over time. Assumes at
// least 2 check-ins — callers should show a "keep checking in" state instead
// of rendering this with fewer, since a single point can't draw a trend.
function SeverityTrendChart({ checkins }: { checkins: ManualCheckin[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const n = checkins.length
  const severities = checkins.map((c) => overallSeverity(c.responses))

  const xFor = (i: number) => (n === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (n - 1)) * PLOT_W)
  const yFor = (v: number) => MARGIN.top + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H

  const linePath = severities.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ')

  const active = activeIndex !== null ? checkins[activeIndex] : null
  const activeBand = activeIndex !== null ? severityBand(severities[activeIndex]) : null
  const activeLeftPct = activeIndex !== null ? (xFor(activeIndex) / VBW) * 100 : 0
  const tooltipAlign = activeLeftPct < 20 ? 'start' : activeLeftPct > 80 ? 'end' : 'center'

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Overall check-in severity over time"
      >
        {[1, 2, 3, 4, 5].map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={VBW - MARGIN.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={yFor(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-neutral-400 text-[10px] dark:fill-neutral-600"
            >
              {tick}
            </text>
          </g>
        ))}

        {checkins.map((c, i) => {
          if (n > 1 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null
          return (
            <text
              key={c.id}
              x={xFor(i)}
              y={VBH - 8}
              textAnchor="middle"
              className="fill-neutral-400 text-[10px] dark:fill-neutral-600"
            >
              {formatShortDate(c.created_at)}
            </text>
          )
        })}

        <path
          d={linePath}
          fill="none"
          className="stroke-neutral-400 dark:stroke-neutral-600"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {checkins.map((c, i) => (
          <circle
            key={c.id}
            cx={xFor(i)}
            cy={yFor(severities[i])}
            r={4}
            className={BAND_FILL[severityBand(severities[i])]}
            stroke="var(--background)"
            strokeWidth={2}
          />
        ))}

        {activeIndex !== null && (
          <line
            x1={xFor(activeIndex)}
            x2={xFor(activeIndex)}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_H}
            className="stroke-neutral-300 dark:stroke-neutral-700"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}

        {checkins.map((c, i) => {
          const bandStart = n === 1 ? MARGIN.left : xFor(i) - PLOT_W / (n - 1) / 2
          const bandWidth = n === 1 ? PLOT_W : PLOT_W / (n - 1)
          return (
            <rect
              key={c.id}
              x={Math.max(MARGIN.left, bandStart)}
              y={MARGIN.top}
              width={bandWidth}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatShortDate(c.created_at)}: ${BAND_LABEL[severityBand(severities[i])]}`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-pointer outline-none"
            />
          )
        })}
      </svg>

      {active && activeBand && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-md border border-neutral-200 bg-white p-3 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900"
          style={
            tooltipAlign === 'end'
              ? { right: `${100 - activeLeftPct}%` }
              : {
                  left: `${activeLeftPct}%`,
                  transform: tooltipAlign === 'center' ? 'translateX(-50%)' : undefined,
                }
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">{formatLongDate(active.created_at)}</p>
            <span className={`shrink-0 font-medium ${BAND_TEXT[activeBand]}`}>{BAND_LABEL[activeBand]}</span>
          </div>
          {active.notes && (
            <p className="mt-2 line-clamp-3 text-neutral-500 dark:text-neutral-400">{active.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

function TrendIndicator({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">Not enough data yet</p>
  }
  if (Math.abs(delta) < 0.25) {
    return (
      <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-500 dark:text-neutral-400">Steady</p>
    )
  }
  const improving = delta < 0
  return (
    <p
      className={`mt-1 text-xl font-semibold tracking-tight ${
        improving ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {improving ? 'Improving' : 'Worsening'}
    </p>
  )
}

function SummaryCards({ checkins }: { checkins: ManualCheckin[] }) {
  const latest = checkins[checkins.length - 1]
  const latestBand = severityBand(overallSeverity(latest.responses))
  const { delta } = severityTrend(checkins)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Total check-ins</p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{checkins.length}</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Latest severity</p>
        <p className={`mt-1 text-xl font-semibold tracking-tight ${BAND_TEXT[latestBand]}`}>
          {BAND_LABEL[latestBand]}
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Recent trend</p>
        <TrendIndicator delta={delta} />
      </div>
    </div>
  )
}

function RecurringRiskAreas({ areas, totalCheckins }: { areas: RecurringRiskArea[]; totalCheckins: number }) {
  if (areas.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-medium">Recurring risk areas</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No question has come back moderate or worse more than once — nothing recurring to flag yet.
        </p>
      </div>
    )
  }

  const maxFlagged = areas[0].flaggedCount

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="font-medium">Recurring risk areas</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Questions rated moderate or worse across your last {totalCheckins} check-ins.
      </p>
      <ul className="mt-4 space-y-3">
        {areas.slice(0, 5).map((area) => (
          <li key={area.questionId}>
            <Link
              href={`/dashboard/check-in/history/${area.questionId}`}
              className="block rounded-md -m-2 p-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-700 dark:text-neutral-300">{area.prompt}</span>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  title={`Flagged in ${area.flaggedCount} of ${area.totalCount} check-ins`}
                >
                  {area.flaggedCount}&times; flagged
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-1.5 rounded-full bg-neutral-900 dark:bg-white"
                  style={{ width: `${(area.flaggedCount / maxFlagged) * 100}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function checkinsToCsv(checkins: ManualCheckin[], questions: CheckInQuestion[]) {
  const header = ['Date', ...questions.map((q) => q.prompt), 'Notes']
  const rows = checkins.map((c) => [
    c.created_at,
    ...questions.map((q) => {
      const value = c.responses[q.id]
      return value === undefined ? '' : RATING_LABEL.get(value) ?? String(value)
    }),
    c.notes ?? '',
  ])
  return [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(',')).join('\n')
}

function downloadCheckinReport(checkins: ManualCheckin[], questions: CheckInQuestion[]) {
  const csv = checkinsToCsv(checkins, questions)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `check-in-history-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Full history & trends view for manual-checkin-track users — the check-in
// track's equivalent of FinancialTrends for the QuickBooks track. Assumes at
// least 2 check-ins (oldest first); callers should show a lighter-weight
// state for 0 or 1.
export function CheckInTrends({
  checkins,
  questions,
}: {
  checkins: ManualCheckin[]
  questions: CheckInQuestion[]
}) {
  const areas = recurringRiskAreas(checkins, questions)

  return (
    <div className="space-y-6">
      <SummaryCards checkins={checkins} />

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Overall severity over time</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Highest-rated question from each of your last {checkins.length} check-ins
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ul className="flex gap-4">
              {BANDS.map((band) => (
                <li
                  key={band}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${BAND_DOT[band]}`} />
                  {BAND_LABEL[band]}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => downloadCheckinReport(checkins, questions)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4">
          <SeverityTrendChart checkins={checkins} />
        </div>
      </div>

      <RecurringRiskAreas areas={areas} totalCheckins={checkins.length} />
    </div>
  )
}
