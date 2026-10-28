// Subset of standard ArduCopter parameters used as a demo preset.
const IRIS = [
  ['ARMING_CHECK', 1, '', '0:Disabled 1:All', 'Arm checks to perform before allowing the vehicle to arm'],
  ['BATT_MONITOR', 4, '', '0:Disabled 4:Analog V+I', 'Battery monitoring type'],
  ['BATT_CAPACITY', 5100, 'mAh', '', 'Capacity of the battery in mAh when full'],
  ['BATT_LOW_VOLT', 10.5, 'V', '', 'Battery voltage that triggers the low battery failsafe'],
  ['BATT_FS_LOW_ACT', 2, '', '0:None 1:Land 2:RTL', 'Action taken when the low battery failsafe triggers'],
  ['FENCE_ENABLE', 1, '', '0:Disabled 1:Enabled', 'Enables geofence'],
  ['FENCE_ALT_MAX', 120, 'm', '10 to 1000', 'Maximum altitude allowed before the geofence triggers'],
  ['FENCE_RADIUS', 1500, 'm', '30 to 10000', 'Circular fence radius around home'],
  ['RTL_ALT', 3000, 'cm', '200 to 300000', 'Altitude the vehicle climbs to before returning home'],
  ['RTL_SPEED', 0, 'cm/s', '0 to 2000', 'Return to home horizontal speed; 0 uses WPNAV_SPEED'],
  ['WPNAV_SPEED', 800, 'cm/s', '20 to 2000', 'Horizontal speed the vehicle tries to hold during missions'],
  ['WPNAV_RADIUS', 200, 'cm', '5 to 1000', 'Distance from a waypoint at which it counts as reached'],
  ['WPNAV_SPEED_UP', 250, 'cm/s', '10 to 1000', 'Climb speed during missions'],
  ['WPNAV_SPEED_DN', 150, 'cm/s', '10 to 500', 'Descent speed during missions'],
  ['FS_GCS_ENABLE', 1, '', '0:Disabled 1:RTL', 'Ground station link loss failsafe'],
  ['FS_THR_ENABLE', 1, '', '0:Disabled 1:RTL', 'Throttle (radio) failsafe'],
  ['GPS_TYPE', 1, '', '1:Auto 5:NMEA', 'GPS receiver type'],
  ['COMPASS_USE', 1, '', '0:Disabled 1:Enabled', 'Use the primary compass for yaw'],
  ['SYSID_THISMAV', 1, '', '1 to 255', 'MAVLink system ID of this vehicle'],
  ['LOG_BITMASK', 176126, '', '', 'Which data is written to the onboard log'],
]

export const PRESETS = {
  '3DR_Iris+': IRIS,
}

export function loadPreset(name) {
  const list = Object.hasOwn(PRESETS, name) ? PRESETS[name] : null
  if (!list) return []
  return list.map(([pname, value, units, options, description]) => ({ name: pname, value, default: value, units, options, description }))
}

export const isModified = (row) => row.value !== row.default

export function filterParams(rows, query, modifiedOnly) {
  const q = query.trim().toLowerCase()
  return rows.filter(
    (r) => (!modifiedOnly || isModified(r)) && (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
  )
}

const FORMAT = 'nidar-params'
export const MAX_PARAMS = 5000

export function serializeParams(rows) {
  return JSON.stringify({ format: FORMAT, version: 1, rows }, null, 2)
}

export function parseParams(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'This file is not a valid parameter file (it is not JSON).' }
  }
  if (!data || data.format !== FORMAT || !Array.isArray(data.rows)) return { error: 'This file is not a NIDAR parameter file.' }
  if (data.rows.length > MAX_PARAMS) return { error: `File has ${data.rows.length} parameters; the limit is ${MAX_PARAMS}.` }
  const rows = []
  const names = new Set()
  for (const [i, r] of data.rows.entries()) {
    if (!r || typeof r.name !== 'string' || !r.name || !Number.isFinite(r.value) || !Number.isFinite(r.default)) {
      return { error: `Row ${i + 1}: needs a name and numeric value and default.` }
    }
    if (names.has(r.name)) return { error: `Row ${i + 1}: ${r.name.slice(0, 40)} appears more than once.` }
    names.add(r.name)
    const text = (v) => (typeof v === 'string' ? v : '')
    rows.push({ name: r.name, value: r.value, default: r.default, units: text(r.units), options: text(r.options), description: text(r.description) })
  }
  return { rows }
}

export function setParamValue(rows, name, raw) {
  const n = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isFinite(n)) return { rows, error: `${name} must be a number.` }
  return { rows: rows.map((r) => (r.name === name ? { ...r, value: n } : r)), error: null }
}
