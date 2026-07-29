'use client'

import { useState } from 'react'
import type { FinancialSnapshot } from '@/lib/supabase/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatMonth(periodEnd: string) {
  return new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

// Series colors follow the app's fixed categorical order (blue, orange, aqua) —
// the CVD-safe adjacent triple defined as --chart-* vars in globals.css.
const SERIES = [
  { key: 'total_revenue', label: 'Revenue', color: 'var(--chart-revenue)' },
  { key: 'total_expenses', label: 'Expenses', color: 'var(--chart-expenses)' },
  { key: 'operating_income', label: 'Operating income', color: 'var(--chart-operating-income)' },
] as const

function niceNum(range: number, round: boolean) {
  if (range === 0) return 1
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / 10 ** exponent
  let niceFraction: number
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * 10 ** exponent
}

function niceScale(min: number, max: number, tickCount = 5) {
  if (min === max) {
    min -= 1
    max += 1
  }
  const range = niceNum(max - min, false)
  const step = niceNum(range / (tickCount - 1), true)
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(v)
  return { min: niceMin, max: niceMax, step, ticks }
}

const VBW = 640
const VBH = 260
const MARGIN = { top: 16, right: 16, bottom: 28, left: 52 }
const PLOT_W = VBW - MARGIN.left - MARGIN.right
const PLOT_H = VBH - MARGIN.top - MARGIN.bottom

function TrendChart({ snapshots }: { snapshots: FinancialSnapshot[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const n = snapshots.length
  const allValues = snapshots.flatMap((s) => [s.total_revenue, s.total_expenses, s.operating_income])
  const { min: yMin, max: yMax, ticks: yTicks } = niceScale(
    Math.min(0, ...allValues),
    Math.max(0, ...allValues),
  )

  const xFor = (i: number) => (n === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (n - 1)) * PLOT_W)
  const yFor = (v: number) => MARGIN.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ')

  const active = activeIndex !== null ? snapshots[activeIndex] : null
  const activeLeftPct = activeIndex !== null ? (xFor(activeIndex) / VBW) * 100 : 0
  const tooltipAlign = activeLeftPct < 20 ? 'start' : activeLeftPct > 80 ? 'end' : 'center'

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Revenue, expenses, and operating income by month"
      >
        {yTicks.map((tick) => (
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
              {compactCurrencyFormatter.format(tick)}
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
              {formatMonth(s.period_end)}
            </text>
          )
        })}

        {SERIES.map((series) => (
          <path
            key={series.key}
            d={linePath(snapshots.map((s) => s[series.key]))}
            fill="none"
            stroke={series.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {SERIES.map((series) => {
          const lastValue = snapshots[n - 1][series.key]
          return (
            <circle
              key={`${series.key}-end`}
              cx={xFor(n - 1)}
              cy={yFor(lastValue)}
              r={4}
              fill={series.color}
              stroke="var(--background)"
              strokeWidth={2}
            />
          )
        })}

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
              aria-label={`${formatMonth(s.period_end)}: revenue ${currencyFormatter.format(
                s.total_revenue,
              )}, expenses ${currencyFormatter.format(s.total_expenses)}, operating income ${currencyFormatter.format(
                s.operating_income,
              )}`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-pointer outline-none"
            />
          )
        })}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-md border border-neutral-200 bg-white p-3 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900"
          style={
            tooltipAlign === 'end'
              ? { right: `${100 - activeLeftPct}%` }
              : {
                  left: `${activeLeftPct}%`,
                  transform: tooltipAlign === 'center' ? 'translateX(-50%)' : undefined,
                }
          }
        >
          <p className="font-medium text-neutral-700 dark:text-neutral-300">
            {new Date(active.period_end).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <dl className="mt-2 space-y-1">
            {SERIES.map((series) => (
              <div key={series.key} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                  <span
                    className="inline-block h-0.5 w-3 shrink-0"
                    style={{ backgroundColor: series.color }}
                  />
                  {series.label}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                  {currencyFormatter.format(active[series.key])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
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
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />
      <circle cx={lastX} cy={lastY} r={2.5} className="fill-blue-600 dark:fill-blue-400" />
    </svg>
  )
}

function snapshotsToCsv(snapshots: FinancialSnapshot[]) {
  const header = ['Date', 'Revenue', 'Expenses', 'Operating Income', 'Cash Balance']
  const rows = snapshots.map((s) => [
    s.period_end,
    s.total_revenue,
    s.total_expenses,
    s.operating_income,
    s.cash_balance,
  ])
  return [header, ...rows].map((row) => row.join(',')).join('\n')
}

function downloadFinancialReport(snapshots: FinancialSnapshot[]) {
  const csv = snapshotsToCsv(snapshots)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `financial-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
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
          ? 'text-xs font-medium text-green-600 dark:text-green-400'
          : 'text-xs font-medium text-red-600 dark:text-red-400'
      }
    >
      {value >= 0 ? '+' : ''}
      {value.toFixed(1)}% vs prior month
    </span>
  )
}

function StatCard({
  label,
  value,
  delta: deltaValue,
  upIsGood,
  sparklineValues,
}: {
  label: string
  value: number
  delta: number | null
  upIsGood: boolean
  sparklineValues?: number[]
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight">{currencyFormatter.format(value)}</p>
        {sparklineValues && sparklineValues.length > 1 && <Sparkline values={sparklineValues} />}
      </div>
      <div className="mt-1">
        <Delta value={deltaValue} upIsGood={upIsGood} />
      </div>
    </div>
  )
}

// Assumes at least 2 snapshots — callers should show a "gathering data"
// state instead of rendering this with fewer, since a single point can't
// draw a trend line.
export function FinancialTrends({ snapshots }: { snapshots: FinancialSnapshot[] }) {
  const latest = snapshots[snapshots.length - 1]
  const prior = snapshots[snapshots.length - 2]

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Cash balance"
          value={latest.cash_balance}
          delta={delta(latest.cash_balance, prior?.cash_balance)}
          upIsGood
          sparklineValues={snapshots.map((s) => s.cash_balance)}
        />
        <StatCard
          label="Revenue"
          value={latest.total_revenue}
          delta={delta(latest.total_revenue, prior?.total_revenue)}
          upIsGood
        />
        <StatCard
          label="Expenses"
          value={latest.total_expenses}
          delta={delta(latest.total_expenses, prior?.total_expenses)}
          upIsGood={false}
        />
        <StatCard
          label="Operating income"
          value={latest.operating_income}
          delta={delta(latest.operating_income, prior?.operating_income)}
          upIsGood
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Revenue, expenses & operating income</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Last {snapshots.length} synced months
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 sm:gap-4">
              {SERIES.map((series) => (
                <li key={series.key} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: series.color }} />
                  {series.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => downloadFinancialReport(snapshots)}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Download report
            </button>
          </div>
        </div>

        <div className="mt-4">
          <TrendChart snapshots={snapshots} />
        </div>
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export function FinancialTrendsSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="mt-2 h-6 w-20" />
            <SkeletonBlock className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <SkeletonBlock className="h-4 w-64" />
        <SkeletonBlock className="mt-2 h-3 w-40" />
        <SkeletonBlock className="mt-6 h-[260px] w-full" />
      </div>
    </div>
  )
}
