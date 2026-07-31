'use client'

import { useState } from 'react'
import type { EngineeringRiskFlag, EngineeringSnapshot } from '@/lib/supabase/types'
import { overallSnapshotSeverity, severityTrend } from '@/lib/github-risk-engine/trends'

function formatShortDate(syncedAt: string) {
  return new Date(syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLongDate(syncedAt: string) {
  return new Date(syncedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const VBW = 640
const VBH = 220
const MARGIN = { top: 16, right: 16, bottom: 28, left: 36 }
const PLOT_W = VBW - MARGIN.left - MARGIN.right
const PLOT_H = VBH - MARGIN.top - MARGIN.bottom
const Y_MIN = 0
const Y_MAX = 4

const SEVERITY_LABEL = ['None', 'Low', 'Medium', 'High', 'Critical']
// Two-tier treatment (urgent red vs. informational neutral) matching
// engineering-risk-flags-list.tsx's SeverityBadge, rather than five distinct
// hues — keeps the chart legible against the app's red/black/gray palette.
const URGENT_SCORE_THRESHOLD = 3 // high (3) and critical (4)

function dotClass(score: number) {
  return score >= URGENT_SCORE_THRESHOLD ? 'fill-red-600 dark:fill-red-400' : 'fill-neutral-400 dark:fill-neutral-600'
}

// Plots the highest-severity flag from each sync over time. Assumes at
// least 2 snapshots — callers should show a "gathering data" state instead
// of rendering this with fewer, since a single point can't draw a trend
// line (same convention as FinancialTrends / CheckInTrends).
function SeverityTrendChart({
  snapshots,
  severities,
}: {
  snapshots: EngineeringSnapshot[]
  severities: number[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const n = snapshots.length

  const xFor = (i: number) => (n === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (n - 1)) * PLOT_W)
  const yFor = (v: number) => MARGIN.top + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H

  const linePath = severities.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ')

  const active = activeIndex !== null ? snapshots[activeIndex] : null
  const activeScore = activeIndex !== null ? severities[activeIndex] : null
  const activeLeftPct = activeIndex !== null ? (xFor(activeIndex) / VBW) * 100 : 0
  const tooltipAlign = activeLeftPct < 20 ? 'start' : activeLeftPct > 80 ? 'end' : 'center'

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Overall GitHub risk severity over time"
      >
        {[0, 1, 2, 3, 4].map((tick) => (
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
              className="fill-neutral-400 text-[9px] dark:fill-neutral-600"
            >
              {SEVERITY_LABEL[tick]}
            </text>
          </g>
        ))}

        {snapshots.map((s, i) => {
          if (n > 1 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null
          return (
            <text
              key={s.id}
              x={xFor(i)}
              y={VBH - 8}
              textAnchor="middle"
              className="fill-neutral-400 text-[10px] dark:fill-neutral-600"
            >
              {formatShortDate(s.synced_at)}
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

        {snapshots.map((s, i) => (
          <circle
            key={s.id}
            cx={xFor(i)}
            cy={yFor(severities[i])}
            r={4}
            className={dotClass(severities[i])}
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

        {snapshots.map((s, i) => {
          const bandStart = n === 1 ? MARGIN.left : xFor(i) - PLOT_W / (n - 1) / 2
          const bandWidth = n === 1 ? PLOT_W : PLOT_W / (n - 1)
          return (
            <rect
              key={s.id}
              x={Math.max(MARGIN.left, bandStart)}
              y={MARGIN.top}
              width={bandWidth}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatShortDate(s.synced_at)}: ${SEVERITY_LABEL[severities[i]]}`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900 dark:focus-visible:outline-white"
            />
          )
        })}
      </svg>

      {active && activeScore !== null && (
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
            <p className="font-medium text-neutral-700 dark:text-neutral-300">{formatLongDate(active.synced_at)}</p>
            <span
              className={`shrink-0 font-medium ${
                activeScore >= URGENT_SCORE_THRESHOLD
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {SEVERITY_LABEL[activeScore]}
            </span>
          </div>
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
    return <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-500 dark:text-neutral-400">Steady</p>
  }
  const improving = delta < 0
  return (
    <p
      className={`mt-1 text-xl font-semibold tracking-tight ${
        improving ? 'text-neutral-700 dark:text-neutral-300' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {improving ? 'Improving' : 'Worsening'}
    </p>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72
  const h = 24
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return [x, y] as const
  })
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-[72px]" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-neutral-300 dark:text-neutral-700"
      />
      <circle cx={lastX} cy={lastY} r={2.5} className="fill-neutral-900 dark:fill-neutral-100" />
    </svg>
  )
}

function delta(current: number, prior: number | undefined) {
  if (prior === undefined || prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

function Delta({ value, upIsGood }: { value: number | null; upIsGood: boolean }) {
  if (value === null) return null
  const isGood = upIsGood ? value >= 0 : value <= 0
  return (
    <span
      className={
        isGood
          ? 'text-xs font-medium text-neutral-600 dark:text-neutral-400'
          : 'text-xs font-medium text-red-600 dark:text-red-400'
      }
    >
      {value >= 0 ? '+' : ''}
      {value.toFixed(1)}% vs prior sync
    </span>
  )
}

function MetricCard({
  label,
  value,
  deltaValue,
  upIsGood,
  sparklineValues,
}: {
  label: string
  value: number
  deltaValue: number | null
  upIsGood: boolean
  sparklineValues: number[]
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight">{value}</p>
        {sparklineValues.length > 1 && <Sparkline values={sparklineValues} />}
      </div>
      <div className="mt-1">
        <Delta value={deltaValue} upIsGood={upIsGood} />
      </div>
    </div>
  )
}

function snapshotsToCsv(snapshots: EngineeringSnapshot[]) {
  const header = [
    'Date',
    'Open PRs',
    'Oldest open PR (days)',
    'Critical issues',
    'Oldest critical issue (days)',
    'Commits (30d)',
  ]
  const rows = snapshots.map((s) => [
    s.synced_at,
    s.open_pr_count,
    s.oldest_open_pr_days ?? '',
    s.open_critical_issue_count,
    s.oldest_critical_issue_days ?? '',
    s.commits_last_30_days,
  ])
  return [header, ...rows].map((row) => row.join(',')).join('\n')
}

function downloadEngineeringReport(snapshots: EngineeringSnapshot[]) {
  const csv = snapshotsToCsv(snapshots)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `engineering-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Trend view for the GitHub-sourced Engineering track — crosses
// FinancialTrends' metric sparklines with CheckInTrends' severity-over-time
// chart and improving/worsening indicator, since GitHub snapshots carry
// both raw metrics (open PRs, commits) and severity-rated risk flags.
// Assumes at least 2 snapshots (oldest first); callers should show a
// lighter-weight state for 0 or 1.
export function EngineeringTrends({
  snapshots,
  flagsBySnapshot,
}: {
  snapshots: EngineeringSnapshot[]
  flagsBySnapshot: Map<string, EngineeringRiskFlag[]>
}) {
  const severities = snapshots.map((s) => overallSnapshotSeverity(flagsBySnapshot.get(s.id) ?? []))
  const { delta: trendDelta } = severityTrend(severities)

  const latest = snapshots[snapshots.length - 1]
  const prior = snapshots[snapshots.length - 2]
  const latestScore = severities[severities.length - 1]

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Total syncs</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{snapshots.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Latest severity</p>
          <p
            className={`mt-1 text-xl font-semibold tracking-tight ${
              latestScore >= URGENT_SCORE_THRESHOLD
                ? 'text-red-600 dark:text-red-400'
                : 'text-neutral-700 dark:text-neutral-300'
            }`}
          >
            {SEVERITY_LABEL[latestScore]}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Recent trend</p>
          <TrendIndicator delta={trendDelta} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Open PRs"
          value={latest.open_pr_count}
          deltaValue={delta(latest.open_pr_count, prior?.open_pr_count)}
          upIsGood={false}
          sparklineValues={snapshots.map((s) => s.open_pr_count)}
        />
        <MetricCard
          label="Critical issues"
          value={latest.open_critical_issue_count}
          deltaValue={delta(latest.open_critical_issue_count, prior?.open_critical_issue_count)}
          upIsGood={false}
          sparklineValues={snapshots.map((s) => s.open_critical_issue_count)}
        />
        <MetricCard
          label="Commits (30d)"
          value={latest.commits_last_30_days}
          deltaValue={delta(latest.commits_last_30_days, prior?.commits_last_30_days)}
          upIsGood
          sparklineValues={snapshots.map((s) => s.commits_last_30_days)}
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Overall risk severity over time</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Highest-severity flag from each of your last {snapshots.length} syncs
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadEngineeringReport(snapshots)}
            className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Download report
          </button>
        </div>

        <div className="mt-4">
          <SeverityTrendChart snapshots={snapshots} severities={severities} />
        </div>
      </div>
    </div>
  )
}
