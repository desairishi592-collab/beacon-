import { describe, expect, it } from 'vitest'
import { buildTeamOverviewCsv, type TeamOverviewRow } from './csv'

describe('buildTeamOverviewCsv', () => {
  it('includes last check-in date and severity trend for a member', () => {
    const rows: TeamOverviewRow[] = [
      {
        name: 'Ana Alvarez',
        role: 'Charge Nurse',
        teamRole: 'member',
        lastCheckInAt: '2026-07-20T12:00:00.000Z',
        trendDelta: 1.2,
      },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [header, dataRow] = csv.split('\r\n')

    expect(header).toBe('Name,Role,Team Role,Last Check-in,Severity Trend')
    expect(dataRow).toBe('Ana Alvarez,Charge Nurse,Member,"July 20, 2026",Worsening')
  })

  it('labels a null trend delta as not enough data, and no check-in as Never', () => {
    const rows: TeamOverviewRow[] = [
      { name: 'New Hire', role: 'Nurse', teamRole: 'member', lastCheckInAt: null, trendDelta: null },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, checkinRow] = csv.split('\r\n')

    expect(checkinRow).toBe('New Hire,Nurse,Member,Never,Not enough data yet')
  })

  it('labels a small delta as Steady and a negative delta as Improving', () => {
    const rows: TeamOverviewRow[] = [
      { name: 'Steady Sam', role: 'Doctor', teamRole: 'member', lastCheckInAt: '2026-07-01', trendDelta: 0.1 },
      { name: 'Improving Ian', role: 'Doctor', teamRole: 'member', lastCheckInAt: '2026-07-01', trendDelta: -0.8 },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, steadyRow, improvingRow] = csv.split('\r\n')

    expect(steadyRow).toContain('Steady')
    expect(improvingRow).toContain('Improving')
  })

  it('escapes commas and quotes in name/role fields', () => {
    const rows: TeamOverviewRow[] = [
      {
        name: 'Doe, Jane "JJ"',
        role: 'VP, Nursing',
        teamRole: 'admin',
        lastCheckInAt: null,
        trendDelta: null,
      },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, dataRow] = csv.split('\r\n')

    expect(dataRow.startsWith('"Doe, Jane ""JJ""","VP, Nursing",Admin')).toBe(true)
  })
})
