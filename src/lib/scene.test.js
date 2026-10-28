import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { SCENE, PEOPLE, pxToM } from './scene'
import { createSim, SECTORS, DETECT_RADIUS, LANE_SPACING } from './simEngine'

const HOME = { lat: -35.3633515, lng: 149.1652412 }
const inside = (r, p) => p.x >= r.xmin && p.x <= r.xmax && p.y >= r.ymin && p.y <= r.ymax

describe('aerial photo scene', () => {
  it('S1 the photo ships with the app', () => {
    expect(existsSync(`public${SCENE.src}`)).toBe(true)
  })

  it('S2 pixel corners map to the photo bounds in metres', () => {
    expect(pxToM(0, 0)).toEqual({ x: SCENE.bounds.xmin, y: SCENE.bounds.ymax })
    const br = pxToM(SCENE.widthPx, SCENE.heightPx)
    expect(br.x).toBeCloseTo(SCENE.bounds.xmax)
    expect(br.y).toBeCloseTo(SCENE.bounds.ymin)
  })

  it('S3 the sim has the 9 people from the photo as survivors, with 9 payloads', () => {
    const s = createSim({ home: HOME })
    expect(PEOPLE).toHaveLength(9)
    expect(s.survivors).toHaveLength(9)
    expect(s.payloads.total).toBe(9)
    s.survivors.forEach((v, i) => expect(v.pos).toEqual(pxToM(PEOPLE[i].px, PEOPLE[i].py)))
  })

  it('S4 every person is on the photo and inside exactly one sector', () => {
    for (const v of createSim({ home: HOME }).survivors) {
      expect(inside(SCENE.bounds, v.pos)).toBe(true)
      expect([SECTORS.A, SECTORS.B].filter((r) => inside(r, v.pos))).toHaveLength(1)
    }
  })

  it('S5 sectors meet in the middle with no gap and home sits just south of the photo', () => {
    expect(SECTORS.A.xmax).toBe(SECTORS.B.xmin)
    expect(inside(SCENE.bounds, { x: 0, y: 0 })).toBe(false)
    expect(SCENE.bounds.ymin).toBeGreaterThan(0)
  })

  it('S6 every person is well inside the detection radius of some search lane', () => {
    for (const v of createSim({ home: HOME }).survivors) {
      const sector = inside(SECTORS.A, v.pos) ? SECTORS.A : SECTORS.B
      const k = Math.round((v.pos.y - sector.ymin) / LANE_SPACING)
      const nearest = Math.min(...[k - 1, k, k + 1].map((j) => Math.abs(v.pos.y - (sector.ymin + j * LANE_SPACING))))
      expect(nearest).toBeLessThan(DETECT_RADIUS * 0.8)
    }
  })
})
