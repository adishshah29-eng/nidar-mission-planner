import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Report from './Report'
import App from '../App'
import { createSim, start, tick } from '../lib/simEngine'
import { CONFIG_DEFAULTS } from '../lib/config'
import { HOME } from '../lib/waypoints'

const home = { lat: HOME.lat, lng: HOME.lng }
const rec = (id, at, over = {}) => ({
  id, at, outcome: 'complete', t: 1437, speed: 5, found: 9, delivered: 9, total: 10, areaPct: 100, km2: 1.1,
  drones: {
    d1: { battery: 38.4, searchedM: 9000, detections: 5, deliveries: 0, lowBattery: false },
    d2: { battery: 28.1, searchedM: 8000, detections: 4, deliveries: 9, lowBattery: true },
  },
  ...over,
})
const show = (props = {}) => render(<Report sim={createSim({ home })} history={[]} onClear={() => {}} config={CONFIG_DEFAULTS} {...props} />)
const value = (name) => within(screen.getByRole('group', { name })).getByTestId('value')

describe('Report screen', () => {
  it('R1 with no history it says so and still shows both drones', () => {
    show()
    expect(screen.getByRole('heading', { level: 1, name: /reports/i })).toBeInTheDocument()
    expect(screen.getByText(/no missions recorded yet/i)).toBeInTheDocument()
    const t = screen.getByRole('table', { name: /drone analytics/i })
    expect(within(t).getByRole('columnheader', { name: /drone 01.*all missions/i })).toBeInTheDocument()
    expect(within(t).getByRole('columnheader', { name: /drone 02.*all missions/i })).toBeInTheDocument()
  })

  it('R2 history lists every mission, newest first, with its outcome', () => {
    show({ history: [rec('a', Date.UTC(2026, 0, 1)), rec('b', Date.UTC(2026, 0, 2), { outcome: 'aborted', delivered: 3 })] })
    const rows = within(screen.getByRole('table', { name: /mission history/i })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/aborted/i)).toBeInTheDocument()
    expect(within(rows[0]).getByText('3 / 10')).toBeInTheDocument()
    expect(within(rows[1]).getByText(/complete/i)).toBeInTheDocument()
    expect(within(rows[1]).getByText('9 / 10')).toBeInTheDocument()
  })

  it('R3 the totals cover all missions', () => {
    show({ history: [rec('a', 1), rec('b', 2)] })
    expect(value('Missions')).toHaveTextContent('2')
    expect(value('Payloads delivered')).toHaveTextContent('18')
    expect(screen.getByRole('row', { name: /^Low-battery returns/ })).toHaveTextContent('2')
    expect(screen.getByRole('row', { name: /^Payloads delivered/ })).toHaveTextContent('18')
  })

  it('R4 the current mission columns fill in once a mission has started', () => {
    let s = start(createSim({ home, speed: 20 }))
    for (let i = 0; i < 10; i++) s = tick(s, 1)
    show({ sim: s })
    const [d1Now] = within(screen.getByRole('row', { name: /^Battery left/ })).getAllByRole('cell')
    expect(d1Now).toHaveTextContent(/^\d+(\.\d)?%$/)
    expect(screen.getByRole('columnheader', { name: /drone 01.*this mission/i })).toBeInTheDocument()
  })

  it('R5 clearing history asks to confirm first', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    show({ history: [rec('a', 1)], onClear })
    await user.click(screen.getByRole('button', { name: /clear history/i }))
    expect(onClear).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /confirm clear/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('R6 a finished mission in the app lands in the report and survives a reload', () => {
    vi.useFakeTimers()
    let s = start(createSim({ home, speed: 20 }))
    for (;;) {
      const n = tick(s, 1)
      if (n.status === 'complete') break
      s = n
    }
    localStorage.setItem('nidar.sim', JSON.stringify({ v: 1, data: s }))
    window.location.hash = '#/reports'
    const { unmount } = render(<App />)
    expect(screen.getByText(/no missions recorded yet/i)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1200))
    const rows = () => within(screen.getByRole('table', { name: /mission history/i })).getAllByRole('row').slice(1)
    expect(rows()).toHaveLength(1)
    expect(value('Missions')).toHaveTextContent('1')
    unmount()
    render(<App />)
    expect(rows()).toHaveLength(1)
  })

  it('R7 Reset in the middle of a mission records an aborted run', () => {
    vi.useFakeTimers()
    window.location.hash = '#/mission'
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start mission/i }))
    act(() => vi.advanceTimersByTime(3000))
    fireEvent.click(screen.getByRole('button', { name: /reset mission/i }))
    act(() => {
      window.location.hash = '#/reports'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    const rows = within(screen.getByRole('table', { name: /mission history/i })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText(/aborted/i)).toBeInTheDocument()
  })
})
