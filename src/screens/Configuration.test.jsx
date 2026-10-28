import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const openPlanner = () => {
  window.location.hash = '#/configuration'
  return render(<App />)
}
const openParams = () => {
  window.location.hash = '#/configuration/params'
  return render(<App />)
}
const paramRows = () => within(screen.getByRole('table', { name: /parameters/i })).getAllByRole('row').slice(1)

afterEach(() => vi.restoreAllMocks())

describe('Configuration', () => {
  it('I12 settings survive a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = openPlanner()
    await user.selectOptions(screen.getByLabelText('Distance units'), 'Feet')
    await user.click(screen.getByLabelText('Map follow (map rotates with the vehicle)'))
    unmount()
    openPlanner()
    expect(screen.getByLabelText('Distance units')).toHaveValue('Feet')
    expect(screen.getByLabelText('Map follow (map rotates with the vehicle)')).toBeChecked()
  })

  it('I13 Reset to defaults brings the default values back', async () => {
    const user = userEvent.setup()
    openPlanner()
    await user.selectOptions(screen.getByLabelText('Distance units'), 'Feet')
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }))
    expect(screen.getByLabelText('Distance units')).toHaveValue('Meters')
  })

  it('an out-of-range number shows an error and is not saved', async () => {
    const user = userEvent.setup()
    const { unmount } = openPlanner()
    const gcs = screen.getByLabelText('GCS ID')
    await user.clear(gcs)
    await user.type(gcs, '300')
    expect(screen.getByRole('alert')).toHaveTextContent(/1.*255/)
    unmount()
    openPlanner()
    expect(screen.getByLabelText('GCS ID')).toHaveValue(255)
  })

  it('I14 the parameter list starts empty with a clear message', () => {
    openParams()
    expect(screen.getByText(/load a preset or a parameter file/i)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /parameters/i })).toBeNull()
  })

  it('I15 load preset, search, edit and show changed only', async () => {
    const user = userEvent.setup()
    openParams()
    await user.click(screen.getByRole('button', { name: /load preset/i }))
    const all = paramRows().length
    expect(all).toBeGreaterThan(10)
    await user.type(screen.getByLabelText('Search parameters'), 'batt')
    expect(paramRows().length).toBeLessThan(all)
    expect(paramRows().every((r) => /batt/i.test(r.textContent))).toBe(true)
    const input = screen.getByLabelText('Value of BATT_CAPACITY')
    await user.clear(input)
    await user.type(input, '6000')
    await user.tab()
    await user.clear(screen.getByLabelText('Search parameters'))
    await user.click(screen.getByLabelText('Changed only'))
    expect(paramRows()).toHaveLength(1)
    expect(paramRows()[0]).toHaveTextContent('BATT_CAPACITY')
  })

  it('U33 in the UI: a non-number value is refused', async () => {
    const user = userEvent.setup()
    openParams()
    await user.click(screen.getByRole('button', { name: /load preset/i }))
    const input = screen.getByLabelText('Value of BATT_CAPACITY')
    await user.clear(input)
    await user.type(input, 'abc')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(/number/i)
    expect(screen.getByLabelText('Value of BATT_CAPACITY')).toHaveValue('5100')
  })

  it('Save to File then Load from File restores parameters', async () => {
    const user = userEvent.setup()
    let blob
    URL.createObjectURL = vi.fn((b) => {
      blob = b
      return 'blob:x'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { unmount } = openParams()
    await user.click(screen.getByRole('button', { name: /load preset/i }))
    const count = paramRows().length
    await user.click(screen.getByRole('button', { name: /save to file/i }))
    const text = await blob.text()
    unmount()
    localStorage.clear()
    openParams()
    await user.upload(screen.getByLabelText(/load parameter file/i), new File([text], 'p.json'))
    expect(await screen.findByRole('table', { name: /parameters/i })).toBeInTheDocument()
    expect(paramRows()).toHaveLength(count)
  })
})
