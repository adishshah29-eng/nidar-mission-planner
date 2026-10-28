import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const SECTIONS = [
  ['Mission', /mission dashboard/i],
  ['Plan', /mission plan/i],
  ['Setup', /vehicle setup & readiness/i],
  ['Configuration', /planner settings/i],
  ['Simulation', /simulation/i],
  ['Help', /help/i],
]

const nav = () => screen.getByRole('navigation', { name: /main/i })

// Walking every screen in jsdom is slow; allow more than the 5 s default.
describe('App shell', { timeout: 30000 }, () => {
  it('I1 every top-bar item opens its section and is highlighted', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const [label, heading] of SECTIONS) {
      const link = within(nav()).getByRole('link', { name: label })
      await user.click(link)
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('I2 opening a section address directly loads it', () => {
    window.location.hash = '#/setup'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /vehicle setup/i })).toBeInTheDocument()
  })

  it('I2 the parameter list has its own address', () => {
    window.location.hash = '#/configuration/params'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /full parameter list/i })).toBeInTheDocument()
  })

  it('I2 an unknown address falls back to the mission dashboard', () => {
    window.location.hash = '#/nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /mission dashboard/i })).toBeInTheDocument()
  })

  it('I17 every button on every screen has an accessible name', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const [label] of SECTIONS) {
      await user.click(within(nav()).getByRole('link', { name: label }))
      for (const b of screen.getAllByRole('button')) expect(b).toHaveAccessibleName()
    }
  })

  it('I18 keyboard Tab reaches the top-bar links in order', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab() // skip link
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(within(nav()).getByRole('link', { name: 'Mission' })).toHaveFocus()
    expect(nav()).toBeInTheDocument()
  })

  it('criterion 9: no Mission Planner leftovers and Attitude is spelled right', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const [label] of SECTIONS) {
      await user.click(within(nav()).getByRole('link', { name: label }))
      expect(document.body.textContent).not.toMatch(/vishas|BurntKermit|Mission Planner/i)
    }
    await user.click(within(nav()).getByRole('link', { name: 'Configuration' }))
    expect(screen.getByLabelText('Attitude (Hz)')).toBeInTheDocument()
  })
})
