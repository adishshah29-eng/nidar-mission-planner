export const CHECKS = [
  { id: 'connection', label: 'Vehicle Connection' },
  { id: 'firmware', label: 'Firmware Version' },
  { id: 'calibration', label: 'Sensor Calibration (IMU/Compass)' },
  { id: 'gps', label: 'GPS Fix (3D)' },
  { id: 'battery', label: 'Battery Health (> 25%)' },
  { id: 'fc', label: 'Flight Controller Health' },
]

export const MIN_BATTERY = 25

export const TYPES = { search: 'Quadrotor (Search)', delivery: 'Quadrotor (Delivery)' }
export const LINKS = { telemetry: 'Telemetry (USB/Radio)', udp: 'UDP (Wi-Fi)', tcp: 'TCP', sitl: 'SITL (Simulator)' }

export function disconnectedDrone(role) {
  return { role, link: 'telemetry', connected: false, firmware: null, calibrated: false, gpsFix: 'none', battery: null, fcHealthy: false }
}

// Simulated link: a real MAVLink connection would fill these from vehicle messages.
export function connectDrone(d) {
  return { ...d, connected: true, firmware: 'ArduCopter 4.6.0', gpsFix: '3d', battery: 100, fcHealthy: true }
}

export function calibrateDrone(d) {
  return { ...d, calibrated: true }
}

export function evaluateChecks(d) {
  const on = d.connected
  return {
    connection: on,
    firmware: on && Boolean(d.firmware),
    calibration: on && d.calibrated,
    gps: on && d.gpsFix === '3d',
    battery: on && typeof d.battery === 'number' && d.battery > MIN_BATTERY,
    fc: on && d.fcHealthy,
  }
}

export function readinessPercent(d) {
  const passed = Object.values(evaluateChecks(d)).filter(Boolean).length
  return Math.round((passed / CHECKS.length) * 100)
}

export function missionReady(drones) {
  return drones.every((d) => readinessPercent(d) === 100)
}

// Drop the link but keep what the operator chose (vehicle type and link type).
export const disconnect = (d) => ({ ...disconnectedDrone(d.role), link: d.link })

// Saved drones come from localStorage: anything half-formed shows as disconnected.
export function sanitizeDrone(d, role) {
  if (!d || typeof d !== 'object') return disconnectedDrone(role)
  const base = { ...disconnectedDrone(Object.hasOwn(TYPES, d.role) ? d.role : role), link: Object.hasOwn(LINKS, d.link) ? d.link : 'telemetry' }
  const live =
    d.connected === true && typeof d.firmware === 'string' && ['3d', 'none'].includes(d.gpsFix) &&
    Number.isFinite(d.battery) && d.battery >= 0 && d.battery <= 100 && typeof d.fcHealthy === 'boolean'
  if (!live) return base
  return { ...base, connected: true, firmware: d.firmware.slice(0, 40), gpsFix: d.gpsFix, battery: d.battery, fcHealthy: d.fcHealthy, calibrated: d.calibrated === true }
}
