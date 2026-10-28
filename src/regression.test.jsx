// Regression tests for the Phase 4 review findings (one block per finding).
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { createSim, isValidSim } from './lib/simEngine'

const HOME = { lat: -35.3633515, lng: 149.1652412 }
const stash = (key, data) => localStorage.setItem(`nidar.${key}`, JSON.stringify({ v: 1, data }))

describe('F1 malformed saved sim data', { timeout: 30000 }, () => {
  it('a sim with empty drones does not blank the app', () => {
    stash('sim', { status: 'running', t: 3, opts: {}, drones: { d1: {}, d2: {} }, survivors: [], payloads: {} })
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /mission dashboard/i })).toBeInTheDocument()
  })

  it('isValidSim accepts a fresh sim and rejects broken shapes', () => {
    const good = createSim({ home: HOME, speed: 1 })
    expect(isValidSim(good)).toBe(true)
    expect(isValidSim({ ...good, survivors: null })).toBe(false)
    expect(isValidSim({ ...good, drones: { ...good.drones, d1: { ...good.drones.d1, pos: { x: 'a', y: 0 } } } })).toBe(false)
    expect(isValidSim({ ...good, status: 'weird' })).toBe(false)
    expect(isValidSim({ ...good, survivors: [{ ...good.survivors[0], status: '"><img>' }] })).toBe(false)
  })

  it('an error anywhere shows a recovery screen with a reset button', async () => {
    const { AppErrorBoundary } = await import('./components/ui')
    const Boom = () => { throw new Error('boom') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByRole('button', { name: /reset saved data/i })).toBeInTheDocument()
    console.error.mockRestore()
  })
})

describe('F2 no crypto.randomUUID on plain-http pages', () => {
  it('missions still get unique ids when randomUUID is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    try {
      const { defaultMission } = await import('./lib/waypoints')
      const ids = defaultMission().items.map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

const wp = (i) => ({ id: `w${i}`, command: 'WAYPOINT', lat: -35.36, lng: 149.16, alt: 100 })

describe('F3 plan size limit', { timeout: 30000 }, () => {
  it('adding at 500 items leaves the list unchanged', async () => {
    const { addWaypoint, insertBelow, MAX_ITEMS } = await import('./lib/waypoints')
    const full = Array.from({ length: MAX_ITEMS }, (_, i) => wp(i))
    expect(addWaypoint(full, { lat: 0, lng: 0 }, 100)).toBe(full)
    expect(insertBelow(full, 0, 100)).toBe(full)
  })

  it('a saved plan over the limit is trimmed on reload, not wiped', async () => {
    const { repairMission, MAX_ITEMS } = await import('./lib/waypoints')
    const fixed = repairMission({ name: 'Big', items: Array.from({ length: MAX_ITEMS + 1 }, (_, i) => wp(i)) })
    expect(fixed.name).toBe('Big')
    expect(fixed.items).toHaveLength(MAX_ITEMS)
  })

  it('one bad saved row is dropped; the rest of the plan survives', async () => {
    const { default: Plan } = await import('./screens/Plan')
    stash('plan', { name: 'Mine', items: [wp(1), { ...wp(2), alt: 'abc' }, wp(3)] })
    render(<Plan />)
    expect(screen.getByLabelText('Mission name')).toHaveValue('Mine')
    expect(screen.getByLabelText('Latitude, row 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Latitude, row 3')).not.toBeInTheDocument()
  })

  it('pressing add at the limit explains why nothing happened', async () => {
    const { default: Plan } = await import('./screens/Plan')
    stash('plan', { name: 'Big', items: Array.from({ length: 500 }, (_, i) => wp(i)) })
    render(<Plan />)
    // fireEvent: userEvent is very slow with 500 rows in jsdom.
    const { fireEvent } = await import('@testing-library/react')
    // querySelector: label/role queries over ~3000 inputs are too slow in jsdom.
    fireEvent.click(document.querySelector('[aria-label="Add waypoint below row 1"]'))
    expect(document.querySelector('[role="alert"]')).toHaveTextContent(/500/)
    expect(document.querySelector('[aria-label="Latitude, row 501"]')).toBeNull()
  })
})

describe('F4 plan settings are validated', () => {
  it('bad saved settings fall back per field and new waypoints get a valid altitude', async () => {
    const { default: Plan } = await import('./screens/Plan')
    const { default: userEvent } = await import('@testing-library/user-event')
    stash('planSettings', { defaultAlt: 'abc', wpRadius: -5, mapLayer: '<x>', altRef: 'Relative', spline: 'yes' })
    render(<Plan />)
    expect(screen.getByLabelText('Default altitude (m)')).toHaveValue(100)
    expect(screen.getByLabelText('Waypoint radius (m)')).toHaveValue(30)
    expect(screen.getByLabelText('Map layer')).toHaveValue('Satellite')
    expect(screen.getByLabelText('Spline path')).not.toBeChecked()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add waypoint below row 1' }))
    expect(screen.getByLabelText('Altitude, row 2')).toHaveValue('100')
  })
})

describe('F5 map marker html only uses known values', () => {
  it('unknown tones and labels never reach the marker html', async () => {
    const { icons } = await import('./components/MapBase')
    const bad = '"><img src=x onerror=alert(1)>'
    expect(icons.survivor(bad).options.html).not.toMatch(/<img|onerror/)
    expect(icons.drone(bad, bad).options.html).not.toMatch(/<img|onerror/)
    expect(icons.survivor('pending').options.html).toContain('mk-pending')
  })
})

describe('F6 stage bar never goes backwards', () => {
  it('stages only move forward over a whole mission', async () => {
    const { start, tick, currentStage } = await import('./lib/simEngine')
    let s = start(createSim({ home: HOME, speed: 1 }))
    const seen = [currentStage(s)]
    for (let i = 0; i < 3000 && s.status === 'running'; i++) {
      s = tick(s, 1)
      seen.push(currentStage(s))
    }
    expect(s.status).toBe('complete')
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    expect(seen.at(-1)).toBe(7)
  })
})

describe('F7 needless re-renders', () => {
  it('marker icons are reused, not rebuilt each render', async () => {
    const { icons } = await import('./components/MapBase')
    expect(icons.survivor('pending')).toBe(icons.survivor('pending'))
    expect(icons.drone('D1', 'd1')).toBe(icons.drone('D1', 'd1'))
    expect(icons.waypoint(3)).toBe(icons.waypoint(3))
  })

  it('the clock and a running sim do not redraw the Plan or Simulation maps', async () => {
    const { act } = await import('@testing-library/react')
    const { start } = await import('./lib/simEngine')
    const { mapRenders } = await import('react-leaflet')
    for (const route of ['#/plan', '#/simulation']) {
      stash('sim', start(createSim({ home: HOME, speed: 1 })))
      window.location.hash = route
      vi.useFakeTimers()
      const { unmount } = render(<App />)
      const before = mapRenders.count
      act(() => vi.advanceTimersByTime(3000))
      expect(mapRenders.count, route).toBe(before)
      unmount()
      vi.useRealTimers()
    }
  })
})

describe('F8 link and GPS status follow Setup', { timeout: 30000 }, () => {
  const health = (label) => screen.getByText(label).closest('li')
  it('with drones disconnected the dashboard says so', () => {
    render(<App />)
    expect(health('Link GCS–D1')).toHaveTextContent(/no link/i)
    expect(health('Link GCS–D2')).toHaveTextContent(/no link/i)
    expect(screen.getAllByText('No fix')).toHaveLength(2)
    expect(screen.queryByText('3D Fix')).not.toBeInTheDocument()
    expect(screen.getByText(/setup is not ready/i)).toBeInTheDocument()
  })

  it('with both drones connected and calibrated the links are good and no warning shows', async () => {
    const { connectDrone, calibrateDrone, disconnectedDrone } = await import('./lib/readiness')
    stash('setup', { d1: calibrateDrone(connectDrone(disconnectedDrone('search'))), d2: calibrateDrone(connectDrone(disconnectedDrone('delivery'))) })
    render(<App />)
    expect(health('Link GCS–D1')).toHaveTextContent('Good')
    expect(screen.getAllByText('3D Fix')).toHaveLength(2)
    expect(screen.queryByText(/setup is not ready/i)).not.toBeInTheDocument()
  })
})

const missionFile = (items) => JSON.stringify({ format: 'nidar-mission', version: 1, name: 'M', items })

describe('F9 duplicates in loaded files', () => {
  it('repeated mission row ids get fresh ids', async () => {
    const { parseMission } = await import('./lib/waypoints')
    const { mission } = parseMission(missionFile([wp(1), wp(1), wp(1)]))
    expect(new Set(mission.items.map((i) => i.id)).size).toBe(3)
  })

  it('repeated parameter names are rejected', async () => {
    const { parseParams } = await import('./lib/params')
    const row = { name: 'RTL_ALT', value: 1, default: 1 }
    const res = parseParams(JSON.stringify({ format: 'nidar-params', rows: [row, row] }))
    expect(res.error).toMatch(/RTL_ALT/)
  })
})

describe('F10 only real command names are accepted', () => {
  it('toString and __proto__ are not commands', async () => {
    const { parseMission } = await import('./lib/waypoints')
    for (const command of ['toString', '__proto__', 'constructor']) {
      expect(parseMission(missionFile([{ ...wp(1), command }])).error).toMatch(/unknown command/)
    }
  })

  it('toString is not a parameter preset', async () => {
    const { loadPreset } = await import('./lib/params')
    expect(loadPreset('toString')).toEqual([])
  })
})

describe('F11 Reset uses the current Simulation settings', { timeout: 30000 }, () => {
  it('after changing home and speed, Reset starts from them', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const newHome = { lat: -35.3, lng: 149.1 }
    stash('sim', createSim({ home: HOME, speed: 5 }))
    stash('simSettings', { home: newHome, speed: 9, firmware: 'Latest (Dev)', link: 'Multilink', vehicle: 'Multirotor' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /reset mission/i }))
    const saved = JSON.parse(localStorage.getItem('nidar.sim')).data
    expect(saved.opts).toEqual({ home: newHome, speed: 9 })
  })
})

describe('F12 Setup data checks and top-bar Disconnect', { timeout: 30000 }, () => {
  it('half-formed saved drones show as disconnected, not a fake Connected', () => {
    stash('setup', { d1: { connected: true }, d2: { connected: 'yes', role: 'x' } })
    window.location.hash = '#/setup'
    render(<App />)
    expect(screen.getByRole('region', { name: 'Drone 01' })).toHaveTextContent('Disconnected')
    expect(screen.getByRole('region', { name: 'Drone 02' })).toHaveTextContent('Disconnected')
  })

  it('top-bar Disconnect keeps each drone’s vehicle type and link', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const { connectDrone, disconnectedDrone } = await import('./lib/readiness')
    stash('setup', { d1: connectDrone({ ...disconnectedDrone('delivery'), link: 'udp' }), d2: connectDrone({ ...disconnectedDrone('search'), link: 'tcp' }) })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /disconnect all drones/i }))
    const saved = JSON.parse(localStorage.getItem('nidar.setup')).data
    expect(saved.d1).toMatchObject({ connected: false, role: 'delivery', link: 'udp' })
    expect(saved.d2).toMatchObject({ connected: false, role: 'search', link: 'tcp' })
  })
})

describe('F13 Plan/sim relationship and parameter empty state', { timeout: 30000 }, () => {
  it('Plan says it is separate from the simulated mission', async () => {
    const { default: Plan } = await import('./screens/Plan')
    render(<Plan />)
    expect(screen.getByText(/not used by the simulated mission/i)).toBeInTheDocument()
  })

  it('the empty parameter list offers a preset button that fills the table', async () => {
    const { fireEvent } = await import('@testing-library/react')
    window.location.hash = '#/configuration/params'
    render(<App />)
    expect(screen.queryByRole('link', { name: /connect vehicle/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /load 3dr_iris\+ preset/i }))
    expect(screen.getByRole('table', { name: /parameters/i })).toBeInTheDocument()
  })
})
