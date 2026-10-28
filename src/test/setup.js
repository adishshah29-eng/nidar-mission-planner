import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.mock('react-leaflet', () => import('./leafletMock.jsx'))

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
  vi.useRealTimers()
})
