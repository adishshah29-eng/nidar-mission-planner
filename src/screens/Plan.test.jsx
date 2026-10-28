import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { mapHandlers } from '../test/leafletMock'

const table = () => screen.getByRole('table', { name: /waypoints/i })
const dataRows = () => within(table()).getAllByRole('row').slice(1)

const open = () => {
  window.location.hash = '#/plan'
  return render(<App />)
}

afterEach(() => vi.restoreAllMocks())

describe('Plan', () => {
  it('I7 clicking the map adds a row and a matching numbered pin', () => {
    open()
    const before = dataRows().length
    act(() => mapHandlers.click({ latlng: { lat: -35.37, lng: 149.17 } }))
    expect(dataRows()).toHaveLength(before + 1)
    const newRow = dataRows()[before - 1]
    expect(within(newRow).getByText(String(before))).toBeInTheDocument()
    expect(screen.getByLabelText(`${before}. Waypoint`)).toBeInTheDocument()
  })

  it('I8 edits and settings survive a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = open()
    const lat = screen.getByLabelText('Latitude, row 2')
    await user.clear(lat)
    await user.type(lat, '-35.35')
    await user.tab()
    const alt = screen.getByLabelText('Default altitude (m)')
    await user.clear(alt)
    await user.type(alt, '120')
    await user.tab()
    unmount()
    open()
    expect(screen.getByLabelText('Latitude, row 2')).toHaveValue('-35.35')
    expect(screen.getByLabelText('Default altitude (m)')).toHaveValue(120)
  })

  it('U23 in the UI: an impossible latitude shows an error and keeps the old value', async () => {
    const user = userEvent.setup()
    open()
    const lat = screen.getByLabelText('Latitude, row 2')
    const old = lat.value
    await user.clear(lat)
    await user.type(lat, '500')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(/latitude/i)
    expect(screen.getByLabelText('Latitude, row 2')).toHaveValue(old)
  })

  it('Delete and Add below change the table', async () => {
    const user = userEvent.setup()
    open()
    const before = dataRows().length
    await user.click(screen.getByRole('button', { name: 'Delete row 2' }))
    expect(dataRows()).toHaveLength(before - 1)
    await user.click(screen.getByRole('button', { name: 'Add waypoint below row 1' }))
    expect(dataRows()).toHaveLength(before)
  })

  it('I9 Save File then Load File brings the plan back, and odd names stay plain text', async () => {
    const user = userEvent.setup()
    let blob
    URL.createObjectURL = vi.fn((b) => {
      blob = b
      return 'blob:x'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    open()
    const name = screen.getByLabelText('Mission name')
    await user.clear(name)
    await user.type(name, '<img src=x onerror=alert(1)>')
    const rows = dataRows().length
    await user.click(screen.getByRole('button', { name: /save file/i }))
    const text = await blob.text()
    await user.click(screen.getByRole('button', { name: 'Delete row 2' }))
    expect(dataRows()).toHaveLength(rows - 1)
    await user.upload(screen.getByLabelText(/load mission file/i), new File([text], 'm.json', { type: 'application/json' }))
    expect(await screen.findByText(/mission loaded/i)).toBeInTheDocument()
    expect(dataRows()).toHaveLength(rows)
    expect(screen.getByLabelText('Mission name')).toHaveValue('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('U26 in the UI: a broken file shows an error and keeps the plan', async () => {
    const user = userEvent.setup()
    open()
    const rows = dataRows().length
    await user.upload(screen.getByLabelText(/load mission file/i), new File(['{oops'], 'bad.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid mission file/i)
    expect(dataRows()).toHaveLength(rows)
  })

  it('refuses files over 1 MB without reading them', () => {
    open()
    const big = new File(['x'], 'big.json')
    Object.defineProperty(big, 'size', { value: 2_000_000 })
    fireEvent.change(screen.getByLabelText(/load mission file/i), { target: { files: [big] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/too large/i)
  })
})
