import { describe, it, expect } from 'vitest'
import { createSim, start, pause, tick, reset, currentStage, areaSearched, STAGES } from './simEngine'

const HOME = { lat: -35.3633515, lng: 149.1652412 }
const running = () => start(createSim({ home: HOME, speed: 1 }))
// Put both drones away from home so 'return home' takes more than one tick.
const away = (s) => ({ ...s, drones: { d1: { ...s.drones.d1, pos: { x: -300, y: 0 } }, d2: { ...s.drones.d2, pos: { x: 300, y: 0 } } } })
const run = (s, seconds) => {
  for (let i = 0; i < seconds; i++) s = tick(s, 1)
  return s
}

describe('simEngine', () => {
  it('U6 starts idle with nothing found', () => {
    const s = createSim({ home: HOME, speed: 1 })
    expect(s.status).toBe('idle')
    expect(s.t).toBe(0)
    expect(s.survivors.every((v) => v.status === 'hidden')).toBe(true)
    expect(STAGES[currentStage(s)]).toBe('Mission Setup')
  })

  it('U7 a running tick advances time, moves drones and drains battery', () => {
    const s0 = running()
    const s1 = tick(s0, 1)
    expect(s1.t).toBe(1)
    expect(s1.drones.d1.pos).not.toEqual(s0.drones.d1.pos)
    expect(s1.drones.d2.pos).not.toEqual(s0.drones.d2.pos)
    expect(s1.drones.d1.battery).toBeLessThan(s0.drones.d1.battery)
  })

  it('U7 speed multiplies simulated time', () => {
    const fast = start(createSim({ home: HOME, speed: 5 }))
    expect(tick(fast, 1).t).toBe(5)
  })

  it('U8 a paused tick changes nothing', () => {
    const p = pause(tick(running(), 1))
    expect(tick(p, 1)).toBe(p)
    expect(tick(createSim({ home: HOME }), 1).t).toBe(0)
  })

  it('U9 detects a survivor once, never twice', () => {
    const s0 = running()
    const target = s0.survivors[0]
    let s = { ...s0, drones: { ...s0.drones, d1: { ...s0.drones.d1, pos: { ...target.pos } } } }
    s = tick(s, 1)
    const found = s.survivors.find((v) => v.id === target.id)
    expect(found.status).not.toBe('hidden')
    expect(found.conf).toBeGreaterThan(0.9)
    const detectedAt = found.detectedAt
    s = run(s, 5)
    expect(s.survivors.filter((v) => v.id === target.id)).toHaveLength(1)
    expect(s.survivors.find((v) => v.id === target.id).detectedAt).toBe(detectedAt)
  })

  it('U10 drone 02 delivers to a found survivor', () => {
    const s0 = running()
    let s = { ...s0, survivors: s0.survivors.map((v, i) => (i === 0 ? { ...v, status: 'pending', detectedAt: 0 } : v)) }
    s = tick(s, 1)
    expect(s.drones.d2.mode).toBe('deliver')
    expect(s.survivors[0].status).toBe('delivering')
    for (let i = 0; i < 400 && s.survivors[0].status !== 'delivered'; i++) s = tick(s, 1)
    expect(s.survivors[0].status).toBe('delivered')
    expect(s.payloads.deployed).toBe(1)
    expect(s.drones.d2.mode).toBe('search')
  })

  it('U11 once everyone is delivered the drones return, land and the mission completes', () => {
    const s0 = running()
    let s = away({ ...s0, survivors: s0.survivors.map((v) => ({ ...v, status: 'delivered', detectedAt: 0 })) })
    s = tick(s, 1)
    expect(s.drones.d1.mode).toBe('rtl')
    expect(STAGES[currentStage(s)]).toBe('Return & Landing')
    for (let i = 0; i < 400 && s.status !== 'complete'; i++) s = tick(s, 1)
    expect(s.status).toBe('complete')
    expect(STAGES[currentStage(s)]).toBe('Reporting')
  })

  it('full mission finds and delivers to every survivor with battery to spare', () => {
    let s = running()
    for (let i = 0; i < 5000 && s.status !== 'complete'; i++) s = tick(s, 1)
    expect(s.status).toBe('complete')
    expect(s.survivors.every((v) => v.status === 'delivered')).toBe(true)
    expect(s.drones.d1.battery).toBeGreaterThan(25)
    expect(s.drones.d2.battery).toBeGreaterThan(25)
  })

  it('U12 low battery triggers return to home', () => {
    const s0 = running()
    const a = away(s0)
    const s = tick({ ...a, drones: { ...a.drones, d1: { ...a.drones.d1, battery: 25.01 } } }, 1)
    expect(s.drones.d1.mode).toBe('rtl')
    expect(s.drones.d1.lowBattery).toBe(true)
  })

  it('U12 low battery while delivering hands the survivor back to pending', () => {
    const s0 = running()
    let s = away({ ...s0, survivors: s0.survivors.map((v, i) => (i === 0 ? { ...v, status: 'pending', detectedAt: 0 } : v)) })
    s = tick(s, 1)
    s = tick({ ...s, drones: { ...s.drones, d2: { ...s.drones.d2, battery: 25 } } }, 1)
    expect(s.drones.d2.mode).toBe('rtl')
    expect(s.survivors[0].status).toBe('pending')
  })

  it('U13 battery never goes negative', () => {
    const s0 = running()
    const s = run({ ...s0, drones: { ...s0.drones, d1: { ...s0.drones.d1, battery: 0.05 } } }, 10)
    expect(s.drones.d1.battery).toBe(0)
  })

  it('U14 reset goes back to the starting state', () => {
    const s0 = createSim({ home: HOME, speed: 2 })
    expect(reset(run(start(s0), 20))).toEqual(s0)
  })

  it('U15 area searched stays in 0..100 and only goes up', () => {
    let s = running()
    let prev = areaSearched(s)
    expect(prev).toBe(0)
    for (let i = 0; i < 3000 && s.status !== 'complete'; i++) {
      s = tick(s, 1)
      const a = areaSearched(s)
      expect(a).toBeGreaterThanOrEqual(prev)
      expect(a).toBeLessThanOrEqual(100)
      prev = a
    }
  })

  it('large ticks are sub-stepped so survivors are not skipped', () => {
    let s = start(createSim({ home: HOME, speed: 20 }))
    for (let i = 0; i < 400 && s.status !== 'complete'; i++) s = tick(s, 1)
    expect(s.survivors.every((v) => v.status === 'delivered')).toBe(true)
  })
})
