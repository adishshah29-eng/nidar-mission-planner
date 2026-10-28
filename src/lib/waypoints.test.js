import { describe, it, expect } from 'vitest'
import {
  defaultMission, addWaypoint, insertBelow, deleteAt, updateAt,
  validateWaypoint, serializeMission, parseMission, MAX_ITEMS,
} from './waypoints'

const items = () => defaultMission().items

describe('waypoints', () => {
  it('U20 adds a waypoint before Return to Home', () => {
    const before = items()
    const after = addWaypoint(before, { lat: -35.36, lng: 149.16 }, 100)
    expect(after).toHaveLength(before.length + 1)
    expect(after.at(-1).command).toBe('RTL')
    expect(after.at(-2)).toMatchObject({ command: 'WAYPOINT', lat: -35.36, lng: 149.16, alt: 100 })
  })

  it('U20 appends when there is no Return to Home', () => {
    expect(addWaypoint([], { lat: 1, lng: 2 }, 50)).toHaveLength(1)
  })

  it('U21 deleting the middle row closes the gap', () => {
    const before = items()
    const after = deleteAt(before, 2)
    expect(after).toHaveLength(before.length - 1)
    expect(after[2]).toBe(before[3])
  })

  it('U22 insert below row 2 lands at position 3', () => {
    const before = items()
    const after = insertBelow(before, 1, 100)
    expect(after).toHaveLength(before.length + 1)
    expect(after[2].command).toBe('WAYPOINT')
    expect(after[2].lat).toBe(before[1].lat)
    expect(after[2].id).not.toBe(before[1].id)
  })

  it('U23 rejects impossible coordinates and non-numbers', () => {
    expect(validateWaypoint({ lat: 91, lng: 0, alt: 10 })).toMatch(/latitude/i)
    expect(validateWaypoint({ lat: 0, lng: -181, alt: 10 })).toMatch(/longitude/i)
    expect(validateWaypoint({ lat: 'abc', lng: 0, alt: 10 })).toMatch(/latitude/i)
    expect(validateWaypoint({ lat: 90, lng: 180, alt: 0 })).toBeNull()
    const before = items()
    const res = updateAt(before, 1, { lat: '999' })
    expect(res.error).toMatch(/latitude/i)
    expect(res.items).toBe(before)
  })

  it('U23 accepts a valid edit given as text', () => {
    const res = updateAt(items(), 1, { lat: '-35.5', alt: '120' })
    expect(res.error).toBeNull()
    expect(res.items[1]).toMatchObject({ lat: -35.5, alt: 120 })
  })

  it('U24 rejects negative or empty altitude', () => {
    expect(validateWaypoint({ lat: 0, lng: 0, alt: -1 })).toMatch(/altitude/i)
    expect(validateWaypoint({ lat: 0, lng: 0, alt: '' })).toMatch(/altitude/i)
  })

  it('U25 save then load gives the same mission', () => {
    const m = { ...defaultMission(), name: 'Sector sweep' }
    expect(parseMission(serializeMission(m))).toEqual({ mission: m })
  })

  it('U26 broken, wrong-type and empty files give an error', () => {
    expect(parseMission('{oops').error).toMatch(/not a valid/i)
    expect(parseMission(JSON.stringify({ hello: 1 })).error).toMatch(/not a NIDAR mission/i)
    expect(parseMission('').error).toBeTruthy()
    const bad = JSON.parse(serializeMission(defaultMission()))
    bad.items[0].lat = 500
    expect(parseMission(JSON.stringify(bad)).error).toMatch(/row 1/i)
  })

  it('U27 refuses files with too many waypoints', () => {
    const m = defaultMission()
    const big = JSON.parse(serializeMission(m))
    big.items = Array.from({ length: 10000 }, () => ({ ...m.items[1] }))
    expect(parseMission(JSON.stringify(big)).error).toContain(String(MAX_ITEMS))
  })

  it('U28 keeps odd characters in the mission name as plain text', () => {
    const m = { ...defaultMission(), name: '<img src=x onerror=alert(1)> Ωmega 🚁' }
    expect(parseMission(serializeMission(m)).mission.name).toBe(m.name)
  })
})
