// Versioned wrapper around localStorage. Never throws: if storage is blocked
// or full, values live in memory for the rest of the session.
export const SCHEMA_VERSION = 1
const PREFIX = 'nidar.'
const memory = new Map()

export function load(key, fallback) {
  let raw
  try {
    raw = localStorage.getItem(PREFIX + key)
  } catch {
    return memory.has(key) ? memory.get(key) : fallback
  }
  if (raw === null) return memory.has(key) ? memory.get(key) : fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed?.v === SCHEMA_VERSION ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export function save(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }))
    memory.delete(key)
    return true
  } catch {
    memory.set(key, data)
    return false
  }
}
