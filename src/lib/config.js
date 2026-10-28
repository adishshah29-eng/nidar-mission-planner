// Planner settings: one schema drives the form, defaults and validation.
const select = (key, label, options) => ({ key, label, type: 'select', options, default: options[0] })
const check = (key, label, def = false) => ({ key, label, type: 'checkbox', default: def })
const number = (key, label, min, max, def) => ({ key, label, type: 'number', min, max, default: def })
const text = (key, label, def) => ({ key, label, type: 'text', default: def })

export const CONFIG_SECTIONS = [
  { title: 'Units', icon: 'ruler', fields: [
    select('distanceUnits', 'Distance units', ['Meters', 'Feet']),
    select('altitudeUnits', 'Altitude units', ['Meters', 'Feet']),
    select('speedUnits', 'Speed units', ['m/s', 'km/h', 'knots']),
  ] },
  { title: 'Telemetry Rates', icon: 'activity', fields: [
    number('rateAttitude', 'Attitude (Hz)', 1, 50, 4),
    number('ratePosition', 'Position (Hz)', 1, 50, 2),
    number('rateMode', 'Mode/Status (Hz)', 1, 50, 2),
    number('rateRc', 'RC (Hz)', 1, 50, 2),
    number('rateSensor', 'Sensor (Hz)', 1, 50, 2),
  ] },
  { title: 'Audio & Language', icon: 'volume', fields: [
    check('speech', 'Enable speech alerts', true),
    select('severity', 'Alert severity', ['Warning', 'Info', 'Critical']),
    select('language', 'Interface language', ['English (United States)', 'English (India)', 'Hindi']),
  ] },
  { title: 'Video & HUD', icon: 'video', fields: [
    check('hudOverlay', 'Show HUD overlay on video', true),
    select('osdColor', 'OSD colour', ['White', 'Yellow', 'Green']),
    check('oldHud', 'Basic HUD (no hardware acceleration)'),
  ] },
  { title: 'Connection & Waypoints', icon: 'link', fields: [
    check('resetOnUsb', 'Reset on USB connect (toggle DTR)'),
    check('disableRts', 'Disable RTS reset on ESP32 SerialUSB'),
    check('loadWpOnConnect', 'Load waypoints on connect'),
  ] },
  { title: 'Track & Navigation', icon: 'map', fields: [
    number('trackLength', 'Track length (points)', 0, 5000, 200),
    check('showDistHome', 'Show distance to home in flight data', true),
    check('mapFollow', 'Map follow (map rotates with the vehicle)'),
  ] },
  { title: 'GCS & Aircraft Display', icon: 'radio', fields: [
    number('gcsId', 'GCS ID', 1, 255, 255),
    check('displayCog', 'Course over ground', true),
    check('displayHeading', 'Heading', true),
    check('displayNavBearing', 'Nav bearing', true),
    check('displayTurnRadius', 'Turn radius', true),
    check('displayTarget', 'Target', true),
    check('displayTooltips', 'Tooltips'),
    select('inactiveAircraft', 'Inactive aircraft', ['Normal', 'Dimmed', 'Hidden']),
  ] },
  { title: 'Additional Options', icon: 'sliders', fields: [
    check('showAirports', 'Show airports', true),
    check('noFly', 'Show no-fly zones', true),
    check('tfrs', 'Show temporary flight restrictions', true),
    check('adsb', 'ADS-B traffic'),
    check('noRc', 'No RC receiver'),
    check('paramsBackground', 'Download parameters in background'),
  ] },
  { title: 'Logs & Map Cache', icon: 'database', fields: [
    text('logPath', 'Log folder', 'Documents/NIDAR/logs'),
    select('mapAccess', 'Map access mode', ['ServerAndCache', 'CacheOnly', 'ServerOnly']),
  ] },
]

const FIELDS = CONFIG_SECTIONS.flatMap((s) => s.fields)

export const CONFIG_DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.key, f.default]))

// Merge saved values over defaults, dropping anything with the wrong type or out of range.
export function sanitizeConfig(saved) {
  const out = { ...CONFIG_DEFAULTS }
  if (!saved || typeof saved !== 'object') return out
  for (const f of FIELDS) {
    const v = saved[f.key]
    if (v === undefined) continue
    if (f.type === 'select' && f.options.includes(v)) out[f.key] = v
    if (f.type === 'checkbox' && typeof v === 'boolean') out[f.key] = v
    if (f.type === 'number' && validateNumber(f, v) === null) out[f.key] = Number(v)
    if (f.type === 'text' && typeof v === 'string') out[f.key] = v.slice(0, 260)
  }
  return out
}

export function validateNumber(f, raw) {
  const n = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isInteger(n) || n < f.min || n > f.max) return `${f.label} must be a whole number from ${f.min} to ${f.max}.`
  return null
}

// Unit formatting used by the dashboard.
export function fmtDistance(m, cfg) {
  return cfg.distanceUnits === 'Feet' ? `${Math.round(m * 3.28084)} ft` : `${Math.round(m)} m`
}
export function fmtAltitude(m, cfg) {
  return cfg.altitudeUnits === 'Feet' ? `${(m * 3.28084).toFixed(1)} ft` : `${m.toFixed(1)} m`
}
export function fmtSpeed(ms, cfg) {
  if (cfg.speedUnits === 'km/h') return `${(ms * 3.6).toFixed(1)} km/h`
  if (cfg.speedUnits === 'knots') return `${(ms * 1.94384).toFixed(1)} kn`
  return `${ms.toFixed(1)} m/s`
}
