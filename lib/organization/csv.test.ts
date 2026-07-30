import { describe, expect, it } from 'vitest'
import { buildTeamOverviewCsv, type TeamOverviewRow } from './csv'

describe('buildTeamOverviewCsv', () => {
  it('includes last check-in date and severity trend for a check-in-track member, leaving sync blank', () => {
    const rows: TeamOverviewRow[] = [
      {
        name: 'Ana Alvarez',
        role: 'Engineering Manager',
        teamRole: 'member',
        track: 'check-in',
        lastCheckInAt: '2026-07-20T12:00:00.000Z',
        trendDelta: 1.2,
      },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [header, dataRow] = csv.split('\r\n')

    expect(header).toBe('Name,Role,Team Role,Last Check-in,Severity Trend,Last Sync')
    expect(dataRow).toBe('Ana Alvarez,Engineering Manager,Member,"July 20, 2026",Worsening,')
  })

  it('includes last sync date for a finance-track member, leaving check-in columns blank', () => {
    const rows: TeamOverviewRow[] = [
      {
        name: 'Priya Shah',
        role: 'Finance Manager',
        teamRole: 'admin',
        track: 'sync',
        lastSyncAt: '2026-07-25T12:00:00.000Z',
      },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, dataRow] = csv.split('\r\n')

    expect(dataRow).toBe('Priya Shah,Finance Manager,Admin,,,"July 25, 2026"')
  })

  it('labels a null trend delta as not enough data, and an unsynced connection as Never', () => {
    const rows: TeamOverviewRow[] = [
      { name: 'New Hire', role: 'Nurse', teamRole: 'member', track: 'check-in', lastCheckInAt: null, trendDelta: null },
      { name: 'Unsynced Co', role: 'Finance Manager', teamRole: 'member', track: 'sync', lastSyncAt: null },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, checkinRow, syncRow] = csv.split('\r\n')

    expect(checkinRow).toBe('New Hire,Nurse,Member,Never,Not enough data yet,')
    expect(syncRow).toBe('Unsynced Co,Finance Manager,Member,,,Never')
  })

  it('labels a small delta as Steady and a negative delta as Improving', () => {
    const rows: TeamOverviewRow[] = [
      { name: 'Steady Sam', role: 'Doctor', teamRole: 'member', track: 'check-in', lastCheckInAt: '2026-07-01', trendDelta: 0.1 },
      { name: 'Improving Ian', role: 'Doctor', teamRole: 'member', track: 'check-in', lastCheckInAt: '2026-07-01', trendDelta: -0.8 },
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
        role: 'VP, Engineering',
        teamRole: 'admin',
        track: 'check-in',
        lastCheckInAt: null,
        trendDelta: null,
      },
    ]

    const csv = buildTeamOverviewCsv(rows)
    const [, dataRow] = csv.split('\r\n')

    expect(dataRow.startsWith('"Doe, Jane ""JJ""","VP, Engineering",Admin')).toBe(true)
  })
})
