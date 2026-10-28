import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import App from '../App'
import { save } from '../lib/storage'
import { createSim, start, tick } from '../lib/simEngine'
import { HOME } from '../lib/waypoints'

const stat = (name) => within(screen.getByRole('group', { name })).getByTestId('value').textContent
const advance = (ms) => act(() => vi.advanceTimersByTime(ms))

describe('Mission dashboard', () => {
  it('I3 Start makes the clock and top numbers move', () => {
    vi.useFakeTimers()
    render(<App />)
    expect(stat('Mission time')).toBe('00:00:00')
    fireEvent.click(screen.getByRole('button', { name: /start mission/i }))
    advance(2500)
    expect(stat('Mission time')).not.toBe('00:00:00')
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('I4 a reload carries on from the saved progress', () => {
    vi.useFakeTimers()
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start mission/i }))
    advance(3000)
    const before = stat('Mission time')
    unmount()
    render(<App />)
    expect(stat('Mission time')).toBe(before)
    expect(screen.getByRole('button', { name: /pause mission/i })).toBeInTheDocument()
  })

  it('I5 Pause stops the numbers', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start mission/i }))
    advance(2000)
    fireEvent.click(screen.getByRole('button', { name: /pause mission/i }))
    const paused = stat('Mission time')
    advance(5000)
    expect(stat('Mission time')).toBe(paused)
  })

  it('Reset puts the mission back to the start', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start mission/i }))
    advance(2000)
    fireEvent.click(screen.getByRole('button', { name: /reset mission/i }))
    expect(stat('Mission time')).toBe('00:00:00')
  })

  it('I6 survivors appear in the detections list and move to Delivered', () => {
    vi.useFakeTimers()
    save('sim', start(createSim({ home: HOME, speed: 20 })))
    render(<App />)
    const list = () => screen.getByRole('region', { name: /detections/i })
    expect(within(list()).getByText(/no survivors detected yet/i)).toBeInTheDocument()
    advance(30000)
    expect(within(list()).getAllByText('Delivered').length).toBeGreaterThan(0)
    expect(stat('Survivors')).not.toBe('0')
  })

  it('shows units from Configuration', () => {
    save('config', { distanceUnits: 'Feet' })
    save('sim', tick(start(createSim({ home: HOME, speed: 1 })), 1))
    render(<App />)
    expect(screen.getAllByText(/ ft$/).length).toBeGreaterThan(0)
  })

  it('I19 the mission map shows the aerial photo over the search area', () => {
    render(<App />)
    const overlay = screen.getByTestId('image-overlay')
    expect(overlay).toHaveAttribute('src', '/search-area.webp')
    const [[s, w], [n, e]] = JSON.parse(overlay.dataset.bounds)
    expect(n).toBeGreaterThan(s)
    expect(e).toBeGreaterThan(w)
  })
})
