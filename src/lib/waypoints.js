export const HOME = { lat: -35.3633515, lng: 149.1652412, altAsl: 587.15 }
export const MAX_ITEMS = 500
const FORMAT = 'nidar-mission'

export const COMMANDS = { TAKEOFF: 'Takeoff', WAYPOINT: 'Waypoint', RTL: 'Return to Home' }

// randomUUID only exists on https/localhost; ids just need to be unique inside one plan.
let seq = 0
export const newId = () => globalThis.crypto?.randomUUID?.() ?? `wp-${Date.now().toString(36)}-${(seq++).toString(36)}`

const item = (command, lat, lng, alt) => ({ id: newId(), command, lat, lng, alt })

export function defaultMission() {
  return {
    name: 'Search & Deliver',
    items: [
      item('TAKEOFF', HOME.lat, HOME.lng, 100),
      item('WAYPOINT', -35.3484, 149.1503, 100),
      item('WAYPOINT', -35.3601, 149.1803, 100),
      item('WAYPOINT', -35.3784, 149.1803, 100),
      item('RTL', HOME.lat, HOME.lng, 100),
    ],
  }
}

export function addWaypoint(items, { lat, lng }, alt) {
  if (items.length >= MAX_ITEMS) return items
  const wp = item('WAYPOINT', lat, lng, alt)
  const rtl = items.length && items.at(-1).command === 'RTL'
  return rtl ? [...items.slice(0, -1), wp, items.at(-1)] : [...items, wp]
}

export function insertBelow(items, index, alt) {
  if (items.length >= MAX_ITEMS) return items
  const src = items[index]
  return [...items.slice(0, index + 1), item('WAYPOINT', src.lat, src.lng, alt), ...items.slice(index + 1)]
}

export function deleteAt(items, index) {
  return items.filter((_, i) => i !== index)
}

const toNum = (v) => (typeof v === 'string' && v.trim() === '' ? NaN : Number(v))

export function validateWaypoint({ lat, lng, alt }) {
  const la = toNum(lat), ln = toNum(lng), al = toNum(alt)
  if (!Number.isFinite(la) || la < -90 || la > 90) return 'Latitude must be a number between -90 and 90.'
  if (!Number.isFinite(ln) || ln < -180 || ln > 180) return 'Longitude must be a number between -180 and 180.'
  if (!Number.isFinite(al) || al < 0 || al > 10000) return 'Altitude must be a number from 0 to 10000 m.'
  return null
}

export function updateAt(items, index, patch) {
  const next = { ...items[index], ...patch }
  const error = validateWaypoint(next)
  if (error) return { items, error }
  const clean = { ...next, lat: Number(next.lat), lng: Number(next.lng), alt: Number(next.alt) }
  return { items: items.map((it, i) => (i === index ? clean : it)), error: null }
}

export function serializeMission(mission) {
  return JSON.stringify({ format: FORMAT, version: 1, ...mission }, null, 2)
}

export function parseMission(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'This file is not a valid mission file (it is not JSON).' }
  }
  if (!data || data.format !== FORMAT || !Array.isArray(data.items)) {
    return { error: 'This file is not a NIDAR mission file.' }
  }
  if (data.items.length > MAX_ITEMS) {
    return { error: `Mission has ${data.items.length} items; the limit is ${MAX_ITEMS}.` }
  }
  for (const [i, it] of data.items.entries()) {
    const problem = rowProblem(it)
    if (problem) return { error: `Row ${i + 1}: ${problem}` }
  }
  return { mission: { name: missionName(data.name), items: cleanRows(data.items) } }
}

const rowProblem = (it) => (!it || !Object.hasOwn(COMMANDS, it.command) ? 'unknown command.' : validateWaypoint(it))
// Ids key the table rows, so a missing or repeated id gets a fresh one.
function cleanRows(rows) {
  const seen = new Set()
  return rows.map((it) => {
    const id = typeof it.id === 'string' && it.id && !seen.has(it.id) ? it.id : newId()
    seen.add(id)
    return { id, command: it.command, lat: Number(it.lat), lng: Number(it.lng), alt: Number(it.alt) }
  })
}
const missionName = (name) => String(name ?? 'Untitled mission').slice(0, 120)

// For data saved by this app: keep every good row (up to the limit) instead of rejecting the whole plan.
export function repairMission(saved) {
  if (!saved || !Array.isArray(saved.items)) return null
  const items = cleanRows(saved.items.filter((it) => !rowProblem(it)).slice(0, MAX_ITEMS))
  return { name: missionName(saved.name), items }
}
