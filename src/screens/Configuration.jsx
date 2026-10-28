import { memo, useState } from 'react'
import { Activity, Database, Link, Map, Radio, Ruler, SlidersHorizontal, Video, Volume2, FolderOpen, Save, Download, RotateCcw, Search, Layers, ClipboardList } from 'lucide-react'
import { Panel, PageHeader, NumberField, SelectField, CheckField } from '../components/ui'
import { CONFIG_SECTIONS, CONFIG_DEFAULTS } from '../lib/config'
import { PRESETS, loadPreset, filterParams, setParamValue, isModified, serializeParams, parseParams } from '../lib/params'
import { usePersistentState, downloadText, readSmallFile } from '../lib/hooks'

const ICONS = { ruler: Ruler, activity: Activity, volume: Volume2, video: Video, link: Link, map: Map, radio: Radio, sliders: SlidersHorizontal, database: Database }

function Planner({ config, setConfig }) {
  const set = (key) => (v) => setConfig((c) => ({ ...c, [key]: v }))
  return (
    <>
      <PageHeader title="Planner Settings" subtitle="Interface, telemetry and display settings for this ground station. Saved in this browser.">
        <button type="button" className="btn" onClick={() => setConfig(CONFIG_DEFAULTS)}>
          <RotateCcw aria-hidden="true" size={18} />Reset to defaults
        </button>
      </PageHeader>
      <div className="config-grid">
        {CONFIG_SECTIONS.map((s) => (
          <Panel key={s.title} title={s.title} icon={ICONS[s.icon]}>
            <div className="config-fields">
              {s.fields.map((f) => {
                if (f.type === 'select') return <SelectField key={f.key} label={f.label} value={config[f.key]} options={f.options} onChange={set(f.key)} />
                if (f.type === 'checkbox') return <CheckField key={f.key} label={f.label} checked={config[f.key]} onChange={set(f.key)} />
                if (f.type === 'number') return <NumberField key={f.key} label={f.label} value={config[f.key]} min={f.min} max={f.max} onCommit={set(f.key)} />
                return (
                  <div key={f.key} className="field field-wide">
                    <label htmlFor={`cfg-${f.key}`}>{f.label}</label>
                    <input id={`cfg-${f.key}`} maxLength={260} value={config[f.key]} onChange={(e) => set(f.key)(e.target.value)} />
                  </div>
                )
              })}
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}

function ValueCell({ row, onCommit }) {
  const [draft, setDraft] = useState(String(row.value))
  const [seen, setSeen] = useState(row.value)
  if (row.value !== seen) {
    setSeen(row.value)
    setDraft(String(row.value))
  }
  return (
    <input
      className="cell-input tabular"
      aria-label={`Value of ${row.name}`}
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== String(row.value) && !onCommit(draft)) setDraft(String(row.value))
      }}
    />
  )
}

const sanitizeParams = (saved) => parseParams(serializeParams(Array.isArray(saved) ? saved : [])).rows ?? []

function ParamList() {
  const [rows, setRows] = usePersistentState('params', [], sanitizeParams)
  const [preset, setPreset] = useState(Object.keys(PRESETS)[0])
  const [query, setQuery] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [message, setMessage] = useState(null)
  const shown = filterParams(rows, query, changedOnly)

  const commit = (name) => (raw) => {
    const res = setParamValue(rows, name, raw)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      return false
    }
    setMessage(null)
    setRows(res.rows)
    return true
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    readSmallFile(
      file,
      (text) => {
        const res = parseParams(text)
        if (res.error) return setMessage({ type: 'error', text: res.error })
        setRows(res.rows)
        setMessage({ type: 'ok', text: `Loaded ${res.rows.length} parameters.` })
      },
      (text) => setMessage({ type: 'error', text }),
    )
  }

  return (
    <>
      <PageHeader title="Full Parameter List" subtitle="View, edit, and manage vehicle parameters." />
      <div className="params-grid">
        <div className="params-main">
          {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`msg msg-${message.type}`}>{message.text}</p>}
          {rows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-ico" aria-hidden="true"><SlidersHorizontal size={40} /></span>
              <p>No parameters yet. Load a preset or a parameter file to view parameters.</p>
              <button type="button" className="btn btn-primary" onClick={() => setRows(loadPreset(preset))}>
                <Download aria-hidden="true" size={18} />Load {preset} preset
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table params-table" aria-label="Parameters">
                <thead><tr><th scope="col">Name</th><th scope="col">Value</th><th scope="col">Units</th><th scope="col">Options</th><th scope="col">Description</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.name} className={isModified(r) ? 'is-modified' : ''}>
                      <th scope="row" className="mono">{r.name}</th>
                      <td><ValueCell row={r} onCommit={commit(r.name)} /></td>
                      <td>{r.units}</td>
                      <td className="muted">{r.options}</td>
                      <td>{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="empty">No parameters match.</p>}
            </div>
          )}
        </div>
        <aside>
          <Panel title="Parameter Actions" icon={Layers}>
            <div className="stack">
              <label className="btn btn-primary file-btn">
                <FolderOpen aria-hidden="true" size={18} />Load from File
                <input type="file" accept=".json,application/json" aria-label="Load parameter file" className="visually-hidden" onChange={onFile} />
              </label>
              <button type="button" className="btn" disabled={!rows.length} onClick={() => downloadText('parameters.json', serializeParams(rows))}>
                <Save aria-hidden="true" size={18} />Save to File
              </button>
              <SelectField label="Preset" value={preset} options={Object.keys(PRESETS)} onChange={setPreset} />
              <button type="button" className="btn btn-primary" onClick={() => { setRows(loadPreset(preset)); setMessage(null) }}>
                <Download aria-hidden="true" size={18} />Load Preset
              </button>
              <button type="button" className="btn" disabled={!rows.some(isModified)} onClick={() => setRows(rows.map((r) => ({ ...r, value: r.default })))}>
                <RotateCcw aria-hidden="true" size={18} />Reset to Default
              </button>
              <div className="field">
                <label htmlFor="param-search">Search parameters</label>
                <div className="search">
                  <Search aria-hidden="true" size={16} />
                  <input id="param-search" type="search" placeholder="Name or description" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              <CheckField label="Changed only" checked={changedOnly} onChange={setChangedOnly} />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  )
}

function Configuration({ sub, config, setConfig }) {
  const tabs = [['', 'Planner', ClipboardList], ['params', 'Full Parameter List', Layers]]
  return (
    <div className="with-side">
      <nav className="side-nav" aria-label="Configuration">
        {tabs.map(([path, label, Icon]) => (
          <a key={label} href={`#/configuration${path ? `/${path}` : ''}`} aria-current={sub === path ? 'page' : undefined}>
            <Icon aria-hidden="true" size={20} />{label}
          </a>
        ))}
      </nav>
      <div className="side-content">{sub === 'params' ? <ParamList /> : <Planner config={config} setConfig={setConfig} />}</div>
    </div>
  )
}

export default memo(Configuration)
