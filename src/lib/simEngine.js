// Pure, deterministic mission simulator. State is plain JSON so it can be saved to localStorage.
import { dist } from './geo'
import { MIN_BATTERY } from './readiness'
import { SCENE, PEOPLE, pxToM } from './scene'

export const STAGES = [
  'Mission Setup', 'Area Allocation', 'Parallel Search', 'Detection & Validation',
  'Geolocation & Deduplication', 'Payload Deployment', 'Return & Landing', 'Reporting',
]

// Two halves of the photo, meeting at x = 0 so nobody falls in a gap between them.
const { ymin: PHOTO_S, ymax: PHOTO_N } = SCENE.bounds
export const SECTORS = {
  A: { xmin: -700, xmax: 0, ymin: PHOTO_S + 20, ymax: PHOTO_N - 20 },
  B: { xmin: 0, xmax: 700, ymin: PHOTO_S + 20, ymax: PHOTO_N - 20 },
}

export const DRONES = {
  d1: { name: 'Drone 01', speed: 8, alt: 54.2, drain: 0.06, sector: 'A' },
  d2: { name: 'Drone 02', speed: 7, alt: 52.6, drain: 0.05, sector: 'B' },
}

const SURVIVORS = PEOPLE.map((p, i) => ({ id: `S${i + 1}`, pos: pxToM(p.px, p.py), conf: p.conf }))

// Lanes closer than 2 x the detection radius, so a drone moving 8 m per step cannot pass someone between lanes.
export const LANE_SPACING = 90
export const DETECT_RADIUS = 50
const HOME_POS = { x: 0, y: 0 }
const FLYING = ['search', 'deliver', 'hold']

// Back-and-forth survey lanes, starting from the side nearest home.
function lawnmower({ xmin, xmax, ymin, ymax }, startAtMax) {
  const pts = []
  for (let y = ymin, i = 0; y <= ymax; y += LANE_SPACING, i++) {
    const [a, b] = (i % 2 === 0) === startAtMax ? [xmax, xmin] : [xmin, xmax]
    pts.push({ x: a, y }, { x: b, y })
  }
  return pts
}

export const pathLength = (path) => path.slice(1).reduce((sum, p, i) => sum + dist(path[i], p), 0)

const newDrone = (path) => ({ pos: { ...HOME_POS }, battery: 100, path, pathIndex: 0, mode: 'search', target: null, lowBattery: false, searched: 0 })

export function createSim({ home, speed = 1 }) {
  return {
    opts: { home, speed },
    status: 'idle',
    t: 0,
    drones: { d1: newDrone(lawnmower(SECTORS.A, true)), d2: newDrone(lawnmower(SECTORS.B, false)) },
    survivors: SURVIVORS.map((s) => ({ ...s, pos: { ...s.pos }, status: 'hidden', detectedAt: null })),
    payloads: { total: SURVIVORS.length, deployed: 0 },
  }
}

const MODES = ['search', 'deliver', 'hold', 'rtl', 'landed']
const SIM_STATUSES = ['idle', 'running', 'paused', 'complete']
export const SURVIVOR_STATUSES = ['hidden', 'pending', 'delivering', 'delivered']
const num = Number.isFinite
const isPoint = (p) => !!p && num(p.x) && num(p.y)

// Saved sims come from localStorage, so check every field the UI reads before trusting one.
export function isValidSim(s) {
  if (!s || !SIM_STATUSES.includes(s.status) || !num(s.t)) return false
  if (s.maxStage !== undefined && !(Number.isInteger(s.maxStage) && s.maxStage >= 0 && s.maxStage < STAGES.length)) return false
  if (!s.opts?.home || !num(s.opts.home.lat) || !num(s.opts.home.lng) || !num(s.opts.speed)) return false
  const droneOk = (d) =>
    !!d && isPoint(d.pos) && num(d.battery) && num(d.searched) && Number.isInteger(d.pathIndex) &&
    MODES.includes(d.mode) && Array.isArray(d.path) && d.path.length > 0 && d.path.every(isPoint)
  if (!droneOk(s.drones?.d1) || !droneOk(s.drones?.d2)) return false
  if (!Array.isArray(s.survivors) || s.survivors.length !== SURVIVORS.length) return false
  if (!s.survivors.every((v, i) => v && v.id === SURVIVORS[i].id && isPoint(v.pos) && num(v.conf) && SURVIVOR_STATUSES.includes(v.status))) return false
  return num(s.payloads?.total) && num(s.payloads?.deployed)
}

export const reset = (s) => createSim(s.opts)
export const start = (s) => (s.status === 'idle' || s.status === 'paused' ? { ...s, status: 'running' } : s)
export const pause = (s) => (s.status === 'running' ? { ...s, status: 'paused' } : s)

export function targetOf(drone, survivors) {
  if (drone.mode === 'search') return drone.path[drone.pathIndex] ?? null
  if (drone.mode === 'deliver') return survivors.find((v) => v.id === drone.target)?.pos ?? null
  if (drone.mode === 'rtl') return HOME_POS
  return null
}

export function tick(state, dt = 1) {
  if (state.status !== 'running') return state
  let s = state
  let remaining = dt * state.opts.speed
  // Sub-step so fast sim speeds cannot fly past a survivor.
  while (remaining > 1e-9 && s.status === 'running') {
    const step = Math.min(1, remaining)
    s = step1(s, step)
    s = { ...s, maxStage: Math.max(s.maxStage ?? 0, rawStage(s)) }
    remaining -= step
  }
  return s
}

function moveToward(pos, target, maxDist) {
  const d = dist(pos, target)
  if (d <= maxDist) return { pos: { ...target }, moved: d, arrived: true }
  const k = maxDist / d
  return { pos: { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k }, moved: maxDist, arrived: false }
}

function step1(s, dt) {
  const t = +(s.t + dt).toFixed(6)
  let survivors = s.survivors.map((v) => ({ ...v }))
  const byId = (id) => survivors.find((v) => v.id === id)
  const drones = {}

  for (const id of ['d1', 'd2']) {
    let d = { ...s.drones[id] }
    if (d.mode !== 'landed') d.battery = Math.max(0, +(d.battery - DRONES[id].drain * dt).toFixed(4))
    if (FLYING.includes(d.mode) && d.battery <= MIN_BATTERY) {
      if (d.mode === 'deliver') byId(d.target).status = 'pending'
      d = { ...d, mode: 'rtl', target: null, lowBattery: true }
    }
    drones[id] = d
  }

  const allDelivered = survivors.every((v) => v.status === 'delivered')
  if (allDelivered) {
    for (const id of ['d1', 'd2']) if (FLYING.includes(drones[id].mode)) drones[id] = { ...drones[id], mode: 'rtl', target: null }
  }

  const d2 = drones.d2
  if (d2.mode === 'search' || d2.mode === 'hold') {
    const next = survivors.find((v) => v.status === 'pending')
    if (next) {
      next.status = 'delivering'
      drones.d2 = { ...d2, mode: 'deliver', target: next.id }
    }
  }

  let deployed = s.payloads.deployed
  for (const id of ['d1', 'd2']) {
    const d = drones[id]
    const target = targetOf(d, survivors)
    if (!target) continue
    const m = moveToward(d.pos, target, DRONES[id].speed * dt)
    const next = { ...d, pos: m.pos }
    if (d.mode === 'search') {
      if (d.pathIndex > 0) next.searched = d.searched + m.moved
      if (m.arrived) next.pathIndex = d.pathIndex + 1
      if (next.pathIndex >= d.path.length) next.mode = id === 'd1' ? 'rtl' : 'hold'
    } else if (d.mode === 'deliver' && m.arrived) {
      byId(d.target).status = 'delivered'
      deployed += 1
      next.target = null
      next.mode = d.pathIndex < d.path.length ? 'search' : 'hold'
    } else if (d.mode === 'rtl' && m.arrived) {
      next.mode = 'landed'
    }
    drones[id] = next
  }

  for (const id of ['d1', 'd2']) {
    if (!FLYING.includes(drones[id].mode)) continue
    for (const v of survivors) {
      if (v.status === 'hidden' && dist(drones[id].pos, v.pos) <= DETECT_RADIUS) {
        v.status = 'pending'
        v.detectedAt = t
        v.detectedBy = id
      }
    }
  }

  // Drone 02 loiters after its sector until nothing is left to find or deliver.
  const d1Done = !FLYING.includes(drones.d1.mode)
  const nothingPending = !survivors.some((v) => v.status === 'pending' || v.status === 'delivering')
  if (drones.d2.mode === 'hold' && nothingPending && d1Done) drones.d2 = { ...drones.d2, mode: 'rtl' }

  const status = drones.d1.mode === 'landed' && drones.d2.mode === 'landed' ? 'complete' : s.status
  return { ...s, t, status, drones, survivors, payloads: { ...s.payloads, deployed } }
}

export function areaSearched(s) {
  const total = pathLength(s.drones.d1.path) + pathLength(s.drones.d2.path)
  return Math.min(100, ((s.drones.d1.searched + s.drones.d2.searched) / total) * 100)
}

export function coverageKm2(s) {
  const area = Object.values(SECTORS).reduce((a, r) => a + (r.xmax - r.xmin) * (r.ymax - r.ymin), 0)
  return (areaSearched(s) / 100) * (area / 1e6)
}

// The bar shows the furthest stage reached, so later detections don't send it backwards.
export const currentStage = (s) => (s.status === 'idle' ? 0 : Math.max(s.maxStage ?? 0, rawStage(s)))

function rawStage(s) {
  if (s.status === 'idle') return 0
  if (s.status === 'complete') return 7
  const { d1, d2 } = s.drones
  const returning = (d) => d.mode === 'rtl' || d.mode === 'landed'
  if (returning(d1) && returning(d2)) return 6
  if (s.survivors.some((v) => v.status === 'delivering')) return 5
  const pending = s.survivors.filter((v) => v.status === 'pending')
  if (pending.length) return s.t - Math.min(...pending.map((v) => v.detectedAt)) < 5 ? 3 : 4
  return s.t < 5 ? 1 : 2
}

export function formatClock(seconds) {
  const sec = Math.max(0, Math.floor(seconds))
  return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
