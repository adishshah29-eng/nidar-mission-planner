import { describe, it, expect, vi, afterEach } from 'vitest'
import { load, save, SCHEMA_VERSION } from './storage'

afterEach(() => vi.restoreAllMocks())

describe('storage', () => {
  it('U1 round-trips a value', () => {
    save('k', { a: 1, b: [2, 3] })
    expect(load('k', null)).toEqual({ a: 1, b: [2, 3] })
  })

  it('U2 returns the default when nothing is saved', () => {
    expect(load('missing', { x: 1 })).toEqual({ x: 1 })
  })

  it('U3 returns the default when stored JSON is corrupt', () => {
    localStorage.setItem('nidar.k', '{not json')
    expect(load('k', 'fallback')).toBe('fallback')
  })

  it('U4 does not throw when storage is blocked or full, and keeps the value in memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(save('blocked', 42)).toBe(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(load('blocked', 0)).toBe(42)
  })

  it('U5 ignores data written by an older schema version', () => {
    localStorage.setItem('nidar.k', JSON.stringify({ v: SCHEMA_VERSION - 1, data: 'old' }))
    expect(load('k', 'new')).toBe('new')
  })
})
