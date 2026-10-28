import { ImageOverlay, Marker, Polygon, Polyline, Tooltip } from 'react-leaflet'
import {
  Users, Package, LayoutGrid, Route, Clock, Play, Pause, RotateCcw, Battery, Signal, Gauge,
  Navigation, Satellite, CircleCheck, TriangleAlert, Check, MoveUp, ListChecks, Waypoints,
} from 'lucide-react'
import { Panel, PageHeader, Dot, QuadIcon, Stat } from '../components/ui'
import { MapBase, icons } from '../components/MapBase'
import { DroneFeed } from '../components/DroneFeed'
import { toLatLng, dist } from '../lib/geo'
import { DRONES, SECTORS, STAGES, currentStage, areaSearched, coverageKm2, formatClock, targetOf } from '../lib/simEngine'
import { fmtAltitude, fmtDistance, fmtSpeed } from '../lib/config'
import { MIN_BATTERY, missionReady } from '../lib/readiness'
import { SCENE } from '../lib/scene'

const FLYING = ['search', 'deliver', 'hold', 'rtl']
const STATUS_LABEL = { pending: 'Pending', delivering: 'Delivering', delivered: 'Delivered' }

function activity(id, d, simStatus) {
  if (simStatus === 'idle') return 'On the pad'
  const sector = DRONES[id].sector
  switch (d.mode) {
    case 'search': return `Searching – Sector ${sector}`
    case 'deliver': return `Delivery – Survivor ${d.target}`
    case 'hold': return `Holding – Sector ${sector} done`
    case 'rtl': return d.lowBattery ? 'Returning home – low battery' : 'Returning home'
    default: return 'Landed'
  }
}

function DroneKpis({ id, d, sim, config, gps }) {
  const flying = FLYING.includes(d.mode) && sim.status !== 'idle'
  const moving = flying && sim.status === 'running'
  const target = targetOf(d, sim.survivors)
  return (
    <Panel title={`${id === 'd1' ? 'D1' : 'D2'} Telemetry`} className="kpis">
      <dl className="kv">
        <div><dt><MoveUp aria-hidden="true" size={16} />Altitude</dt><dd>{fmtAltitude(flying ? DRONES[id].alt : 0, config)}</dd></div>
        <div><dt><Gauge aria-hidden="true" size={16} />Speed</dt><dd>{fmtSpeed(moving ? DRONES[id].speed : 0, config)}</dd></div>
        <div><dt><Navigation aria-hidden="true" size={16} />To waypoint</dt><dd>{target && flying ? fmtDistance(dist(d.pos, target), config) : '—'}</dd></div>
        <div><dt><Battery aria-hidden="true" size={16} />Battery</dt><dd className={d.battery <= MIN_BATTERY ? 'warn' : ''}>{Math.round(d.battery)}%</dd></div>
        <div><dt><Satellite aria-hidden="true" size={16} />GPS</dt><dd className={gps === '3d' ? '' : 'warn'}>{gps === '3d' ? '3D Fix' : 'No fix'}</dd></div>
      </dl>
    </Panel>
  )
}

function DroneCamera({ id, d, sim }) {
  return (
    <section className="camera" aria-label={`${DRONES[id].name} camera`}>
      <header className="camera-head">
        <Dot tone={sim.status === 'running' && d.mode !== 'landed' ? 'ok' : 'idle'} />
        <strong>{DRONES[id].name.toUpperCase()}</strong>
        <span className="camera-activity">{activity(id, d, sim.status)}</span>
        <span className="camera-batt"><Battery aria-hidden="true" size={16} />{Math.round(d.battery)}%</span>
        <Signal aria-hidden="true" size={16} />
      </header>
      <DroneFeed name={DRONES[id].name} drone={d} home={sim.opts.home} survivors={sim.survivors} deliverTarget={id === 'd2' ? d.target : null} />
      <span className="camera-tag">{sim.status === 'running' ? 'LIVE · SIM' : 'SIM'}</span>
    </section>
  )
}

function MissionMap({ sim }) {
  const home = sim.opts.home
  const ll = (p) => toLatLng(home, p)
  const rect = (r) => [ll({ x: r.xmin, y: r.ymin }), ll({ x: r.xmax, y: r.ymin }), ll({ x: r.xmax, y: r.ymax }), ll({ x: r.xmin, y: r.ymax })]
  const { xmin, xmax, ymin, ymax } = SCENE.bounds
  const photo = [ll({ x: xmin, y: ymin }), ll({ x: xmax, y: ymax })]
  const middle = ll({ x: 0, y: (ymin + ymax) / 2 - 40 })
  const covered = (d) => (d.pathIndex > 0 ? [...d.path.slice(0, d.pathIndex), d.mode === 'search' ? d.pos : d.path[d.pathIndex - 1]].map(ll) : [])
  return (
    <MapBase center={middle} zoom={16} label="Mission map">
      <ImageOverlay url={SCENE.src} bounds={photo} />
      <Polygon positions={rect(SECTORS.A)} pathOptions={{ color: '#7BC043', weight: 2, fillColor: '#5DA332', fillOpacity: 0.06 }}>
        <Tooltip permanent direction="center" className="sector-label">Sector A (D1)</Tooltip>
      </Polygon>
      <Polygon positions={rect(SECTORS.B)} pathOptions={{ color: '#7BC043', weight: 2, fillColor: '#E8ECE4', fillOpacity: 0.06 }}>
        <Tooltip permanent direction="center" className="sector-label">Sector B (D2)</Tooltip>
      </Polygon>
      {['d1', 'd2'].map((id) => (
        <Polyline key={`p-${id}`} positions={sim.drones[id].path.map(ll)} pathOptions={{ color: '#fff', weight: 1.5, dashArray: '6 6', opacity: 0.8 }} />
      ))}
      {['d1', 'd2'].map((id) => (
        <Polyline key={`c-${id}`} positions={covered(sim.drones[id])} pathOptions={{ color: '#9BE15D', weight: 22, opacity: 0.35, lineCap: 'butt' }} />
      ))}
      <Marker position={[home.lat, home.lng]} icon={icons.home} title="Home" />
      {sim.survivors.filter((v) => v.status !== 'hidden').map((v) => (
        <Marker key={v.id} position={ll(v.pos)} icon={icons.survivor(v.status)} title={`Survivor ${v.id}, ${STATUS_LABEL[v.status]}`} />
      ))}
      {['d1', 'd2'].map((id) => (
        <Marker key={id} position={ll(sim.drones[id].pos)} icon={icons.drone(id.toUpperCase(), id)} title={DRONES[id].name} zIndexOffset={1000} />
      ))}
    </MapBase>
  )
}

function Stages({ index }) {
  return (
    <ol className="stages" aria-label="Mission stages">
      {STAGES.map((s, i) => {
        const state = i < index ? 'done' : i === index ? 'current' : 'todo'
        return (
          <li key={s} className={`stage stage-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stage-mark" aria-hidden="true">{state === 'done' ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
            <span>{s}</span>
            <span className="visually-hidden">{state === 'done' ? ' (done)' : state === 'current' ? ' (current)' : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Mission({ simCtl, config, simSettings, setup }) {
  const { sim } = simCtl
  const { d1, d2 } = sim.drones
  const found = sim.survivors.filter((v) => v.status !== 'hidden')
  const stage = currentStage(sim)
  const airborne = [d1, d2].filter((d) => sim.status !== 'idle' && FLYING.includes(d.mode)).length
  const next = sim.survivors.find((v) => v.status === 'delivering') ?? sim.survivors.find((v) => v.status === 'pending')
  const lowBatt = ['d1', 'd2'].filter((id) => sim.drones[id].lowBattery)
  const health = [
    ['Battery', `> ${MIN_BATTERY}%`, [d1, d2].every((d) => d.battery > MIN_BATTERY)],
    ['Link GCS–D1', setup.d1.connected ? 'Good' : 'No link', setup.d1.connected],
    ['Link GCS–D2', setup.d2.connected ? 'Good' : 'No link', setup.d2.connected],
    ['Geofence', 'Active', true],
    ['Collision avoidance', 'Active', true],
    ['RTL on low battery', lowBatt.length ? `Triggered (${lowBatt.map((i) => i.toUpperCase()).join(', ')})` : 'Armed', !lowBatt.length],
  ]

  return (
    <div className="mission">
      <PageHeader title="Mission Dashboard" subtitle={`Dual-drone search & rescue · ${simSettings.vehicle} swarm · ${simSettings.link}`}>
        <div className="mission-controls">
          {sim.status === 'running' ? (
            <button type="button" className="btn btn-primary" onClick={simCtl.pause} aria-label="Pause mission">
              <Pause aria-hidden="true" size={18} />Pause
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={simCtl.start} disabled={sim.status === 'complete'} aria-label="Start mission">
              <Play aria-hidden="true" size={18} />{sim.status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          <button type="button" className="btn" onClick={simCtl.reset} aria-label="Reset mission">
            <RotateCcw aria-hidden="true" size={18} />Reset
          </button>
        </div>
      </PageHeader>

      {!missionReady([setup.d1, setup.d2]) && (
        <p className="msg msg-warn" role="status">
          Setup is not ready, so this run is simulation only. <a href="#/setup">Connect and calibrate both drones in Setup</a>.
        </p>
      )}

      <div className="stats">
        <Stat icon={QuadIcon} label="Drones airborne" value={`${airborne} / 2`} />
        <Stat icon={Users} label="Survivors" value={String(found.length)} />
        <Stat icon={Package} label="Payloads" value={`${sim.payloads.deployed} / ${sim.payloads.total}`} />
        <Stat icon={LayoutGrid} label="Area searched" value={`${areaSearched(sim).toFixed(1)}%`} />
        <Stat icon={Route} label="Coverage" value={`${coverageKm2(sim).toFixed(2)} km²`} />
        <Stat icon={Clock} label="Mission time" value={formatClock(sim.t)} />
        <div className="stat stat-status" role="group" aria-label="Mission status">
          <ListChecks aria-hidden="true" size={26} />
          <div>
            <span className="stat-label">Mission status</span>
            <span className="stat-value">{STAGES[stage]}</span>
          </div>
        </div>
      </div>

      <div className="feeds">
        <DroneCamera id="d1" d={d1} sim={sim} />
        <DroneKpis id="d1" d={d1} sim={sim} config={config} gps={setup.d1.connected ? setup.d1.gpsFix : null} />
        <DroneCamera id="d2" d={d2} sim={sim} />
        <DroneKpis id="d2" d={d2} sim={sim} config={config} gps={setup.d2.connected ? setup.d2.gpsFix : null} />
      </div>

      <div className="ops">
        <div className="ops-col">
          <Panel title="Detections (Live)">
            {found.length === 0 ? (
              <p className="empty">No survivors detected yet.</p>
            ) : (
              <ul className="det-list">
                {found.map((v) => (
                  <li key={v.id} className={v.status === 'delivering' ? 'is-active' : ''}>
                    <strong>{v.id}</strong>
                    <span className="muted tabular">Conf {v.conf.toFixed(2)}</span>
                    <span className={`det-status det-${v.status}`}>{STATUS_LABEL[v.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Payload Status">
            <div className="kv-row">
              <span>Deployed</span>
              <strong className="tabular">{sim.payloads.deployed} / {sim.payloads.total}</strong>
            </div>
            <div className="bar" role="progressbar" aria-label="Payloads deployed" aria-valuemin={0} aria-valuemax={sim.payloads.total} aria-valuenow={sim.payloads.deployed}>
              <span style={{ width: `${(sim.payloads.deployed / sim.payloads.total) * 100}%` }} />
            </div>
            <div className="kv-row">
              <span>Next delivery</span>
              <strong>{next ? `${next.id} (D2)` : '—'}</strong>
            </div>
          </Panel>
        </div>

        <div className="ops-map">
          <MissionMap sim={sim} />
          <ul className="legend" aria-label="Map legend">
            <li><span className="lg lg-boundary" />Sector boundary</li>
            <li><span className="lg lg-path" />Search path</li>
            <li><span className="lg lg-drone" />Drone</li>
            <li><span className="lg lg-survivor" />Survivor</li>
            <li><span className="lg lg-coverage" />Coverage</li>
          </ul>
        </div>

        <div className="ops-col">
          <Panel title="Task Allocation" icon={Waypoints}>
            <ul className="tasks">
              <li><strong>D1</strong> {activity('d1', d1, sim.status)}</li>
              <li><strong>D2</strong> {activity('d2', d2, sim.status)}</li>
            </ul>
          </Panel>
          <Panel title="Failsafe & Health">
            <ul className="health">
              {health.map(([label, value, ok]) => (
                <li key={label}>
                  {ok ? <CircleCheck aria-hidden="true" size={18} className="ok" /> : <TriangleAlert aria-hidden="true" size={18} className="warn" />}
                  <span>{label}</span>
                  <strong className={ok ? 'ok' : 'warn'}>{value}</strong>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Stages index={stage} />
    </div>
  )
}
