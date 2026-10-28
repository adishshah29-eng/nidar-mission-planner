import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const card = (name) => screen.getByRole('region', { name })
const readiness = () => screen.getByRole('region', { name: /mission readiness/i })

const open = () => {
  window.location.hash = '#/setup'
  return render(<App />)
}

describe('Setup', () => {
  it('I10 connecting Drone 01 updates its badge, checks and percentage', async () => {
    const user = userEvent.setup()
    open()
    expect(within(card('Drone 01')).getByText('Disconnected')).toBeInTheDocument()
    expect(within(readiness()).getByLabelText('Drone 01 readiness')).toHaveTextContent('0%')
    await user.click(within(card('Drone 01')).getByRole('button', { name: 'Connect Drone 01' }))
    expect(within(card('Drone 01')).getByText('Connected')).toBeInTheDocument()
    expect(within(readiness()).getByLabelText('Drone 01 readiness')).toHaveTextContent('83%')
    await user.click(within(card('Drone 01')).getByRole('button', { name: 'Calibrate Drone 01' }))
    expect(within(readiness()).getByLabelText('Drone 01 readiness')).toHaveTextContent('100%')
    expect(within(readiness()).getByLabelText('Drone 02 readiness')).toHaveTextContent('0%')
  })

  it('Calibrate is disabled until the drone is connected', () => {
    open()
    expect(screen.getByRole('button', { name: 'Calibrate Drone 01' })).toBeDisabled()
  })

  it('I11 both drones connected and calibrated shows Ready, and it survives a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = open()
    expect(within(readiness()).getByText('Not Ready')).toBeInTheDocument()
    for (const d of ['Drone 01', 'Drone 02']) {
      await user.click(screen.getByRole('button', { name: `Connect ${d}` }))
      await user.click(screen.getByRole('button', { name: `Calibrate ${d}` }))
    }
    expect(within(readiness()).getByText('Ready')).toBeInTheDocument()
    unmount()
    open()
    expect(within(readiness()).getByText('Ready')).toBeInTheDocument()
  })

  it('the top-bar Connect connects both drones', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Connect all drones' }))
    expect(within(card('Drone 01')).getByText('Connected')).toBeInTheDocument()
    expect(within(card('Drone 02')).getByText('Connected')).toBeInTheDocument()
  })

  it('Disconnect resets the drone to not ready', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Connect Drone 02' }))
    await user.click(screen.getByRole('button', { name: 'Disconnect Drone 02' }))
    expect(within(readiness()).getByLabelText('Drone 02 readiness')).toHaveTextContent('0%')
  })
})
