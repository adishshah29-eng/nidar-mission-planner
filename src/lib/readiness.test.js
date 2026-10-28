import { describe, it, expect } from 'vitest'
import { CHECKS, evaluateChecks, readinessPercent, missionReady, disconnectedDrone, connectDrone, calibrateDrone } from './readiness'

describe('readiness', () => {
  it('U16 a disconnected drone has every check pending and 0%', () => {
    const d = disconnectedDrone('search')
    expect(Object.values(evaluateChecks(d)).every((v) => v === false)).toBe(true)
    expect(readinessPercent(d)).toBe(0)
    expect(missionReady([d, d])).toBe(false)
  })

  it('U17 half the checks passed gives 50%', () => {
    const d = { ...disconnectedDrone('search'), connected: true, firmware: 'ArduCopter 4.6.0', fcHealthy: true }
    expect(CHECKS).toHaveLength(6)
    expect(readinessPercent(d)).toBe(50)
  })

  it('U18 both drones fully ready means mission ready', () => {
    const d = calibrateDrone(connectDrone(disconnectedDrone('search')))
    expect(readinessPercent(d)).toBe(100)
    expect(missionReady([d, d])).toBe(true)
    expect(missionReady([d, connectDrone(disconnectedDrone('delivery'))])).toBe(false)
  })

  it('U19 battery must be strictly above 25%', () => {
    const base = calibrateDrone(connectDrone(disconnectedDrone('search')))
    expect(evaluateChecks({ ...base, battery: 25 }).battery).toBe(false)
    expect(evaluateChecks({ ...base, battery: 24 }).battery).toBe(false)
    expect(evaluateChecks({ ...base, battery: 26 }).battery).toBe(true)
    expect(evaluateChecks({ ...base, battery: null }).battery).toBe(false)
  })

  it('calibration only counts on a connected drone', () => {
    expect(evaluateChecks(calibrateDrone(disconnectedDrone('search'))).calibration).toBe(false)
  })
})
