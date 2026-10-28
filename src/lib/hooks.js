import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { load, save } from './storage'
import { createSim, tick, start, pause, isValidSim } from './simEngine'
import { finishedRun, sanitizeHistory, MAX_HISTORY } from './history'

export function usePersistentState(key, initial, sanitize = (v) => v) {
  const [value, setValue] = useState(() => sanitize(load(key, typeof initial === 'function' ? initial() : initial)))
  useEffect(() => {
    save(key, value)
  }, [key, value])
  return [value, setValue]
}

const subscribeHash = (cb) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHashRoute() {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.replace(/^#\/?/, ''))
}

export function navigate(path) {
  window.location.hash = `#/${path}`
}

const TICK_MS = 500

export function useSimulation(defaults) {
  const [sim, setSim] = usePersistentState('sim', () => createSim(defaults), (s) => (isValidSim(s) ? s : createSim(defaults)))
  useEffect(() => {
    if (sim.status !== 'running') return
    const id = setInterval(() => setSim((s) => tick(s, TICK_MS / 1000)), TICK_MS)
    return () => clearInterval(id)
  }, [sim.status, setSim])
  // Reset reads the latest Simulation settings without making the controls change identity.
  const latest = useRef(defaults)
  useEffect(() => {
    latest.current = defaults
  })
  // Stable control functions, so screens that only launch the sim can skip re-rendering on every tick.
  const controls = useMemo(
    () => ({
      start: () => setSim(start),
      pause: () => setSim(pause),
      reset: () => setSim(createSim(latest.current)),
      launch: (opts) => setSim(start(createSim(opts))),
    }),
    [setSim],
  )
  return useMemo(() => ({ sim, ...controls }), [sim, controls])
}

// Saves a record whenever a mission completes or is reset/replaced part-way through.
export function useMissionHistory(sim) {
  const [history, setHistory] = usePersistentState('history', () => [], sanitizeHistory)
  const prev = useRef(sim)
  useEffect(() => {
    const rec = finishedRun(prev.current, sim)
    prev.current = sim
    if (rec) setHistory((h) => [...h, rec].slice(-MAX_HISTORY))
  }, [sim, setHistory])
  const clear = useCallback(() => setHistory([]), [setHistory])
  return [history, clear]
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const MAX_FILE_BYTES = 1_000_000

// Reads a user-picked file as text, refusing anything over 1 MB before reading it.
export function readSmallFile(file, onText, onError) {
  if (!file) return
  if (file.size > MAX_FILE_BYTES) return onError('That file is too large (over 1 MB).')
  file.text().then(onText, () => onError('Could not read that file.'))
}
