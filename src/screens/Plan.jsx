import { memo, useState } from 'react'
import { Marker, Polygon, Polyline } from 'react-leaflet'
import { FolderOpen, Save, Trash2, Plus, Crosshair, Settings2 } from 'lucide-react'
import { Panel, PageHeader, NumberField, SelectField, CheckField } from '../components/ui'
import { MapBase, MAP_LAYERS, icons } from '../components/MapBase'
import { usePersistentState, downloadText, readSmallFile } from '../lib/hooks'
import {
  HOME, COMMANDS, MAX_ITEMS, defaultMission, addWaypoint, insertBelow, deleteAt, updateAt, serializeMission, parseMission, repairMission,
} from '../lib/waypoints'
import { validateNumber } from '../lib/config'

const BOUNDARY = [
  [-35.3445, 149.1475], [-35.3425, 149.1725], [-35.3525, 149.1855],
  [-35.3815, 149.1865], [-35.3845, 149.1515], [-35.3660, 149.1420],
]

const PLAN_DEFAULTS = {
  mapLayer: 'Satellite', missionType: 'Survey (Search)', wpRadius: 30, loiterRadius: 45,
  defaultAlt: 100, altRef: 'Relative', verifyHeight: true, spline: false,
}
const PLAN_FIELDS = { wpRadius: [1, 500], loiterRadius: [1, 1000], defaultAlt: [0, 10000] }
const MISSION_TYPES = ['Survey (Search)', 'Delivery', 'Search & Deliver']
const ALT_REFS = ['Relative', 'Absolute', 'Terrain']

const sanitizePlan = (saved) => repairMission(saved) ?? defaultMission()

// Same rule as Configuration: each saved field must be valid on its own, or it falls back to its default.
function sanitizeSettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {}
  const out = { ...PLAN_DEFAULTS }
  if (MAP_LAYERS.includes(s.mapLayer)) out.mapLayer = s.mapLayer
  if (MISSION_TYPES.includes(s.missionType)) out.missionType = s.missionType
  if (ALT_REFS.includes(s.altRef)) out.altRef = s.altRef
  for (const k of ['verifyHeight', 'spline']) if (typeof s[k] === 'boolean') out[k] = s[k]
  for (const [k, [min, max]] of Object.entries(PLAN_FIELDS)) {
    if (typeof s[k] === 'number' && !validateNumber({ min, max }, String(s[k]))) out[k] = s[k]
  }
  return out
}

function CoordCell({ label, value, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(String(value))
  }
  return (
    <input
      className="cell-input tabular"
      aria-label={label}
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== String(value) && !onCommit(draft)) setDraft(String(value))
      }}
    />
  )
}

function Plan() {
  const [plan, setPlan] = usePersistentState('plan', defaultMission, sanitizePlan)
  const [settings, setSettings] = usePersistentState('planSettings', PLAN_DEFAULTS, sanitizeSettings)
  const [message, setMessage] = useState(null)
  const set = (key) => (v) => setSettings((s) => ({ ...s, [key]: v }))
  const setItems = (items) => setPlan((p) => ({ ...p, items }))
  const grow = (items) => {
    if (items === plan.items) return setMessage({ type: 'error', text: `A mission can have at most ${MAX_ITEMS} items. Delete one to add another.` })
    setMessage(null)
    setItems(items)
  }

  const edit = (index, field) => (raw) => {
    const res = updateAt(plan.items, index, { [field]: raw })
    if (res.error) {
      setMessage({ type: 'error', text: `Row ${index + 1}: ${res.error}` })
      return false
    }
    setMessage(null)
    setItems(res.items)
    return true
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    readSmallFile(
      file,
      (text) => {
        const res = parseMission(text)
        if (res.error) return setMessage({ type: 'error', text: res.error })
        setPlan(res.mission)
        setMessage({ type: 'ok', text: `Mission loaded: ${res.mission.items.length} items.` })
      },
      (text) => setMessage({ type: 'error', text }),
    )
  }

  const save = () => {
    const slug = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mission'
    downloadText(`${slug}.json`, serializeMission(plan))
  }

  const wpMarkers = plan.items.map((it, i) => ({ ...it, n: i + 1 })).filter((it) => it.command === 'WAYPOINT')

  return (
    <div className="plan">
      <PageHeader title="Mission Plan" subtitle="Draw the route on the map and fine-tune each waypoint in the table." />
      <div className="plan-grid">
        <div className="plan-main">
          <div className="plan-map">
            <MapBase
              center={[HOME.lat, HOME.lng]}
              zoom={14}
              layer={settings.mapLayer}
              label="Plan map"
              onClick={(ll) => {
                grow(addWaypoint(plan.items, { lat: +ll.lat.toFixed(7), lng: +ll.lng.toFixed(7) }, settings.defaultAlt))
              }}
            >
              <Polygon positions={BOUNDARY} pathOptions={{ color: '#9BE15D', weight: 3, fillColor: '#5DA332', fillOpacity: 0.25 }} />
              <Polyline positions={plan.items.map((it) => [it.lat, it.lng])} pathOptions={{ color: '#fff', weight: 2, dashArray: '8 8' }} />
              <Marker position={[HOME.lat, HOME.lng]} icon={icons.home} title="Home" />
              {wpMarkers.map((it) => (
                <Marker key={it.id} position={[it.lat, it.lng]} icon={icons.waypoint(it.n)} title={`${it.n}. Waypoint`} />
              ))}
            </MapBase>
            <div className="map-overlay">
              <label htmlFor="mission-name">Mission</label>
              <input id="mission-name" aria-label="Mission name" maxLength={120} value={plan.name} onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <p className="hint"><Crosshair aria-hidden="true" size={16} />Click the map to add a waypoint before Return to Home.</p>
          <p className="hint muted">This route is saved and exported as a file. It is not used by the simulated mission, which flies its own search pattern from the home set in Simulation.</p>

          {message && (
            <p role={message.type === 'error' ? 'alert' : 'status'} className={`msg msg-${message.type}`}>
              {message.text}
            </p>
          )}

          <div className="table-wrap">
            <table className="table" aria-label="Waypoints">
              <thead>
                <tr><th scope="col">#</th><th scope="col">Command</th><th scope="col">Latitude (°)</th><th scope="col">Longitude (°)</th><th scope="col">Altitude (m)</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {plan.items.map((it, i) => (
                  <tr key={it.id}>
                    <td className="tabular">{i + 1}</td>
                    <td>
                      <select aria-label={`Command, row ${i + 1}`} value={it.command} onChange={(e) => setItems(plan.items.map((x, j) => (j === i ? { ...x, command: e.target.value } : x)))}>
                        {Object.entries(COMMANDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><CoordCell label={`Latitude, row ${i + 1}`} value={it.lat} onCommit={edit(i, 'lat')} /></td>
                    <td><CoordCell label={`Longitude, row ${i + 1}`} value={it.lng} onCommit={edit(i, 'lng')} /></td>
                    <td><CoordCell label={`Altitude, row ${i + 1}`} value={it.alt} onCommit={edit(i, 'alt')} /></td>
                    <td className="row-actions">
                      <button type="button" className="icon-btn" aria-label={`Add waypoint below row ${i + 1}`} title="Add below" onClick={() => grow(insertBelow(plan.items, i, settings.defaultAlt))}>
                        <Plus aria-hidden="true" size={18} />
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete row ${i + 1}`} title="Delete" onClick={() => setItems(deleteAt(plan.items, i))}>
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="plan-side">
          <Panel title="Map & Mission Settings" icon={Settings2}>
            <SelectField label="Map layer" value={settings.mapLayer} options={MAP_LAYERS} onChange={set('mapLayer')} />
            <SelectField label="Mission type" value={settings.missionType} options={MISSION_TYPES} onChange={set('missionType')} />
            {Object.entries({ wpRadius: 'Waypoint radius (m)', loiterRadius: 'Loiter radius (m)', defaultAlt: 'Default altitude (m)' }).map(([k, label]) => (
              <NumberField key={k} label={label} value={settings[k]} min={PLAN_FIELDS[k][0]} max={PLAN_FIELDS[k][1]} onCommit={set(k)} />
            ))}
            <SelectField label="Altitude reference" value={settings.altRef} options={ALT_REFS} onChange={set('altRef')} />
            <div className="checks">
              <CheckField label="Verify height" checked={settings.verifyHeight} onChange={set('verifyHeight')} />
              <CheckField label="Spline path" checked={settings.spline} onChange={set('spline')} />
            </div>
            <div className="btn-row">
              <label className="btn btn-primary file-btn">
                <FolderOpen aria-hidden="true" size={18} />Load File
                <input type="file" accept=".json,application/json" aria-label="Load mission file" className="visually-hidden" onChange={onFile} />
              </label>
              <button type="button" className="btn btn-primary" onClick={save}>
                <Save aria-hidden="true" size={18} />Save File
              </button>
            </div>
          </Panel>
          <Panel title="Home Location (GPS)">
            <dl className="kv">
              <div><dt>Latitude</dt><dd>{HOME.lat.toFixed(7)}°</dd></div>
              <div><dt>Longitude</dt><dd>{HOME.lng.toFixed(7)}°</dd></div>
              <div><dt>Altitude (ASL)</dt><dd>{HOME.altAsl} m</dd></div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export default memo(Plan)
