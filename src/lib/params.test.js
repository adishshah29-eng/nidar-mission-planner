import { describe, it, expect } from 'vitest'
import { PRESETS, loadPreset, filterParams, setParamValue, isModified, serializeParams, parseParams } from './params'

const rows = () => loadPreset(Object.keys(PRESETS)[0])

describe('params', () => {
  it('U29 loading a preset fills the table', () => {
    expect(rows().length).toBeGreaterThan(10)
    expect(rows().every((r) => !isModified(r))).toBe(true)
    expect(loadPreset('nope')).toEqual([])
  })

  it('U30 search matches name or description, any case', () => {
    const out = filterParams(rows(), 'BATT', false)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((r) => /batt/i.test(r.name + r.description))).toBe(true)
  })

  it('U31 empty search shows every row', () => {
    expect(filterParams(rows(), '  ', false)).toHaveLength(rows().length)
  })

  it('U32 modified-only shows just edited rows', () => {
    const r = rows()
    const { rows: edited, error } = setParamValue(r, r[0].name, String(r[0].value + 1))
    expect(error).toBeNull()
    const out = filterParams(edited, '', true)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe(r[0].name)
  })

  it('U34 save then load a parameter file round-trips', () => {
    const r = setParamValue(rows(), 'BATT_CAPACITY', '6000').rows
    expect(parseParams(serializeParams(r))).toEqual({ rows: r })
  })

  it('U35 broken or wrong parameter files give an error', () => {
    expect(parseParams('{oops').error).toMatch(/not a valid/i)
    expect(parseParams(JSON.stringify({ format: 'other' })).error).toMatch(/not a Solder & Forget parameter file/i)
    const bad = JSON.parse(serializeParams(rows()))
    bad.rows[0].value = 'abc'
    expect(parseParams(JSON.stringify(bad)).error).toMatch(/row 1/i)
  })

  it('U33 non-numbers are rejected', () => {
    const r = rows()
    const res = setParamValue(r, r[0].name, 'abc')
    expect(res.error).toMatch(/number/i)
    expect(res.rows).toBe(r)
    expect(setParamValue(r, r[0].name, '').error).toMatch(/number/i)
  })
})
