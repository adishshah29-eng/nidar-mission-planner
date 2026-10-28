import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { mapHandlers } from '../test/leafletMock'
import { load } from '../lib/storage'

describe('Simulation', () => {
  it('I16 choosing settings and starting the swarm runs the mission from the chosen home', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/simulation'
    render(<App />)
    await user.click(screen.getByRole('radio', { name: /rover/i }))
    const speed = screen.getByLabelText('Simulation speed (x)')
    await user.clear(speed)
    await user.type(speed, '10')
    act(() => mapHandlers.click({ latlng: { lat: -35.3, lng: 149.1 } }))
    expect(screen.getByText(/-35\.300000, 149\.100000/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start rover swarm/i }))
    expect(window.location.hash).toBe('#/mission')
    expect(screen.getByRole('heading', { level: 1, name: /mission dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getByText(/rover swarm/i)).toBeInTheDocument()
    const sim = load('sim', null)
    expect(sim.opts).toEqual({ home: { lat: -35.3, lng: 149.1 }, speed: 10 })
  })

  it('rejects a speed outside 1 to 20', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/simulation'
    render(<App />)
    const speed = screen.getByLabelText('Simulation speed (x)')
    await user.clear(speed)
    await user.type(speed, '50')
    expect(screen.getByRole('alert')).toHaveTextContent(/1.*20/)
    expect(screen.getByRole('button', { name: /start .* swarm/i })).toBeDisabled()
  })
})
