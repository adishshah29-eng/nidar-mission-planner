// Past missions for the Report screen. A record is written when a mission completes,
// or when it is thrown away mid-way by Reset or a new launch.
import { areaSearched, coverageKm2 } from './simEngine'

export const MAX_HISTORY = 100
const IDS = ['d1', 'd2']
const OUTCOMES = ['complete', 'aborted']

const droneRow = (s, id) => ({
  battery: Math.round(s.drones[id].battery * 10) / 10,
  searchedM: Math.round(s.drones[id].searched),
  detections: s.survivors.filter((v) => v.detectedBy === id).length,
  // Drone 02 carries the payloads; Drone 01 only searches.
  deliveries: id === 'd2' ? s.payloads.deployed : 0,
  lowBattery: !!s.drones[id].lowBattery,
})

// Numbers worth keeping from a sim, also used for the live "this mission" column.
export const summarizeRun = (s) => ({
  t: Math.round(s.t),
  speed: s.opts.speed,
  found: s.survivors.filter((v) => v.status !== 'hidden').length,
  delivered: s.payloads.deployed,
  total: s.payloads.total,
  areaPct: +areaSearched(s).toFixed(1),
  km2: +coverageKm2(s).toFixed(2),
  drones: { d1: droneRow(s, 'd1'), d2: droneRow(s, 'd2') },
})

// Compares two consecutive sim states and returns a record if a mission just ended.
export function finishedRun(prev, next, now = Date.now()) {
  let outcome = null
  let source = null
  if (prev.status !== 'complete' && next.status === 'complete') {
    outcome = 'complete'
    source = next
  } else if ((prev.status === 'running' || prev.status === 'paused') && next.t < prev.t) {
    // Time went backwards: the mission was reset or replaced.
    outcome = 'aborted'
    source = prev
  }
  if (!outcome) return null
  return { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, at: now, outcome, ...summarizeRun(source) }
}

const num = Number.isFinite
const droneOk = (d) => !!d && num(d.battery) && num(d.searchedM) && num(d.detections) && num(d.deliveries) && typeof d.lowBattery === 'boolean'
const recordOk = (r) =>
  !!r && typeof r.id === 'string' && num(r.at) && OUTCOMES.includes(r.outcome) &&
  ['t', 'speed', 'found', 'delivered', 'total', 'areaPct', 'km2'].every((k) => num(r[k])) &&
  IDS.every((id) => droneOk(r.drones?.[id]))

// Saved history comes from localStorage, so keep only well-formed records.
export const sanitizeHistory = (list) => (Array.isArray(list) ? list.filter(recordOk).slice(-MAX_HISTORY) : [])

const sum = (list, f) => list.reduce((a, r) => a + f(r), 0)
const avg = (list, f) => (list.length ? sum(list, f) / list.length : null)

export function aggregate(history) {
  const done = history.filter((r) => r.outcome === 'complete')
  const perDrone = (id) => ({
    searchedM: sum(history, (r) => r.drones[id].searchedM),
    avgBattery: avg(history, (r) => r.drones[id].battery),
    detections: sum(history, (r) => r.drones[id].detections),
    deliveries: sum(history, (r) => r.drones[id].deliveries),
    lowBattery: history.filter((r) => r.drones[id].lowBattery).length,
  })
  return {
    missions: history.length,
    completed: done.length,
    aborted: history.length - done.length,
    avgDuration: avg(done, (r) => r.t),
    avgArea: avg(history, (r) => r.areaPct),
    found: sum(history, (r) => r.found),
    delivered: sum(history, (r) => r.delivered),
    drones: { d1: perDrone('d1'), d2: perDrone('d2') },
  }
}
