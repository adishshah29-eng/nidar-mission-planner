import { describe, it, expect } from 'vitest'
import { createSim, start, tick } from './simEngine'
import { finishedRun, sanitizeHistory, aggregate, summarizeRun, MAX_HISTORY } from './history'
import { HOME } from './waypoints'

const home = { lat: HOME.lat, lng: HOME.lng }

// Steps a fast mission until the step that completes it; returns [last running state, completed state].
function lastStep() {
  let s = start(createSim({ home, speed: 20 }))
  for (;;) {
    const n = tick(s, 1)
    if (n.status === 'complete') return [s, n]
    s = n
  }
}

const rec = (over = {}, d1 = {}, d2 = {}) => ({
  id: 'a', at: 1000, outcome: 'complete', t: 1400, speed: 5, found: 9, delivered: 9, total: 10, areaPct: 100, km2: 1.1,
  drones: {
    d1: { battery: 40, searchedM: 8000, detections: 5, deliveries: 0, lowBattery: false, ...d1 },
    d2: { battery: 30, searchedM: 7000, detections: 4, deliveries: 9, lowBattery: false, ...d2 },
  },
  ...over,
})

describe('mission history', () => {
  it('H1 nothing is recorded while a mission is still running or paused', () => {
    const s = start(createSim({ home, speed: 20 }))
    expect(finishedRun(s, tick(s, 1))).toBeNull()
    expect(finishedRun(s, { ...s, status: 'paused' })).toBeNull()
  })

  it('H2 the step that completes a mission records it with both drones', () => {
    const [prev, done] = lastStep()
    const r = finishedRun(prev, done, 1234)
    expect(r).toMatchObject({ at: 1234, outcome: 'complete', delivered: 9, total: 10, found: 9 })
    expect(r.t).toBeGreaterThan(1000)
    expect(r.drones.d2.deliveries).toBe(9)
    expect(r.drones.d1.deliveries).toBe(0)
    expect(r.drones.d1.detections + r.drones.d2.detections).toBe(9)
    expect(r.drones.d1.searchedM).toBeGreaterThan(0)
    expect(typeof r.id).toBe('string')
  })

  it('H3 a finished mission is not recorded twice or again after Reset', () => {
    const [, done] = lastStep()
    expect(finishedRun(done, tick(done, 1))).toBeNull()
    expect(finishedRun(done, createSim({ home }))).toBeNull()
  })

  it('H4 Reset or a new launch mid-mission records an aborted run', () => {
    let s = start(createSim({ home, speed: 20 }))
    for (let i = 0; i < 5; i++) s = tick(s, 1)
    for (const next of [createSim({ home }), start(createSim({ home }))]) {
      const r = finishedRun(s, next, 5)
      expect(r.outcome).toBe('aborted')
      expect(r.t).toBe(Math.round(s.t))
    }
    const paused = { ...s, status: 'paused' }
    expect(finishedRun(paused, createSim({ home }))?.outcome).toBe('aborted')
  })

  it('H5 resetting an idle sim records nothing', () => {
    const idle = createSim({ home })
    expect(finishedRun(idle, createSim({ home }))).toBeNull()
  })

  it('H6 summarizeRun works on a mission in progress', () => {
    const s = summarizeRun(createSim({ home }))
    expect(s).toMatchObject({ t: 0, found: 0, delivered: 0, total: 10 })
    expect(s.drones.d1.battery).toBe(100)
  })

  it('H7 loading saved history drops junk, keeps valid records and caps the length', () => {
    expect(sanitizeHistory('nope')).toEqual([])
    expect(sanitizeHistory(null)).toEqual([])
    const good = rec()
    const bad = [{}, null, 5, rec({ outcome: 'weird' }), rec({ t: 'x' }), { ...rec(), drones: { d1: rec().drones.d1 } }, rec({ id: 7 })]
    expect(sanitizeHistory([good, ...bad])).toEqual([good])
    const many = Array.from({ length: MAX_HISTORY + 20 }, (_, i) => rec({ id: String(i) }))
    const kept = sanitizeHistory(many)
    expect(kept).toHaveLength(MAX_HISTORY)
    expect(kept.at(-1).id).toBe(String(MAX_HISTORY + 19))
  })

  it('H8 aggregate totals and averages per drone', () => {
    const a = aggregate([
      rec(),
      rec({ id: 'b', t: 1600, delivered: 7, areaPct: 80 }, { battery: 20, lowBattery: true }, { battery: 10 }),
      rec({ id: 'c', outcome: 'aborted', t: 100, areaPct: 5, delivered: 0 }),
    ])
    expect(a).toMatchObject({ missions: 3, completed: 2, aborted: 1, delivered: 16, found: 27 })
    expect(a.avgDuration).toBe(1500)
    expect(a.avgArea).toBeCloseTo((100 + 80 + 5) / 3)
    expect(a.drones.d1).toMatchObject({ searchedM: 24000, detections: 15, lowBattery: 1 })
    expect(a.drones.d1.avgBattery).toBeCloseTo((40 + 20 + 40) / 3)
    expect(a.drones.d2.deliveries).toBe(27)
  })

  it('H9 aggregate of nothing is empty, not NaN', () => {
    const a = aggregate([])
    expect(a).toMatchObject({ missions: 0, completed: 0, avgDuration: null, avgArea: null, delivered: 0 })
    expect(a.drones.d1.avgBattery).toBeNull()
  })
})
