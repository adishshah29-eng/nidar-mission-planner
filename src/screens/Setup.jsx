import { memo } from 'react'
import { Crosshair, MapPin, BatteryFull, Cpu, Link, Unlink, Settings, ClipboardCheck, Rocket, Check, CircleCheck, Circle } from 'lucide-react'
import { Panel, PageHeader, Dot, QuadIcon } from '../components/ui'
import { CHECKS, evaluateChecks, readinessPercent, missionReady, connectDrone, calibrateDrone, disconnect, TYPES, LINKS } from '../lib/readiness'

const NAMES = { d1: 'Drone 01', d2: 'Drone 02' }

function DroneCard({ id, d, update }) {
  const checks = evaluateChecks(d)
  const rows = [
    [Crosshair, 'Sensor calibration', checks.calibration ? 'Calibrated' : 'Not calibrated', checks.calibration],
    [MapPin, 'GPS readiness', checks.gps ? '3D Fix' : 'No fix', checks.gps],
    [BatteryFull, 'Battery status', d.connected && d.battery !== null ? `${d.battery}%` : '—', checks.battery],
    [Cpu, 'Flight controller', checks.fc ? `Healthy · ${d.firmware}` : 'Not detected', checks.fc],
  ]
  return (
    <Panel title={NAMES[id]} icon={QuadIcon} className="drone-card" actions={
      <span className={`badge ${d.connected ? 'badge-ok' : 'badge-off'}`}><Dot tone={d.connected ? 'ok' : 'bad'} />{d.connected ? 'Connected' : 'Disconnected'}</span>
    }>
      <div className="drone-card-body">
        <div className="drone-fields">
          <div className="drone-art" aria-hidden="true"><QuadIcon size={64} /></div>
          <div className="field">
            <label htmlFor={`${id}-type`}>Vehicle type</label>
            <select id={`${id}-type`} value={d.role} onChange={(e) => update((x) => ({ ...x, role: e.target.value }))}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-link`}>Telemetry link</label>
            <select id={`${id}-link`} value={d.link} disabled={d.connected} onChange={(e) => update((x) => ({ ...x, link: e.target.value }))}>
              {Object.entries(LINKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <ul className="status-list">
          {rows.map(([Icon, label, value, ok]) => (
            <li key={label}>
              <Icon aria-hidden="true" size={18} className="brand-ico" />
              <span>{label}</span>
              <span className="status-val"><Dot tone={ok ? 'ok' : 'idle'} />{value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="btn-row">
        {d.connected ? (
          <button type="button" className="btn" aria-label={`Disconnect ${NAMES[id]}`} onClick={() => update(disconnect)}>
            <Unlink aria-hidden="true" size={18} />Disconnect
          </button>
        ) : (
          <button type="button" className="btn btn-primary" aria-label={`Connect ${NAMES[id]}`} onClick={() => update(connectDrone)}>
            <Link aria-hidden="true" size={18} />Connect
          </button>
        )}
        <button type="button" className="btn" aria-label={`Calibrate ${NAMES[id]}`} disabled={!d.connected || d.calibrated} onClick={() => update(calibrateDrone)}>
          <Settings aria-hidden="true" size={18} />{d.calibrated ? 'Calibrated' : 'Calibrate'}
        </button>
      </div>
    </Panel>
  )
}

function Setup({ setup, setSetup }) {
  const drones = [setup.d1, setup.d2]
  const ready = missionReady(drones)
  const steps = [
    ['Connect vehicles', drones.every((d) => d.connected)],
    ['Configure', drones.every((d) => d.connected)],
    ['Calibrate', drones.every((d) => d.connected && d.calibrated)],
    ['Verify', ready],
  ]
  const current = steps.findIndex(([, done]) => !done)
  const update = (id) => (fn) => setSetup((s) => ({ ...s, [id]: fn(s[id]) }))

  return (
    <div className="setup">
      <PageHeader title="Vehicle Setup & Readiness" subtitle="Connect, configure, and prepare both drones for the mission.">
        <ol className="stepper" aria-label="Setup progress">
          {steps.map(([label, done], i) => (
            <li key={label} className={done ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
              <span className="step-mark" aria-hidden="true">{done ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </PageHeader>

      <div className="drone-cards">
        <DroneCard id="d1" d={setup.d1} update={update('d1')} />
        <DroneCard id="d2" d={setup.d2} update={update('d2')} />
      </div>

      <div className="readiness-grid">
        <Panel title="Readiness Checklist" icon={ClipboardCheck}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Check</th><th scope="col">Drone 01</th><th scope="col">Drone 02</th></tr></thead>
              <tbody>
                {CHECKS.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.label}</th>
                    {drones.map((d, i) => {
                      const ok = evaluateChecks(d)[c.id]
                      return (
                        <td key={i}>
                          <span className={`check-state ${ok ? 'ok' : ''}`}>
                            {ok ? <CircleCheck aria-hidden="true" size={16} /> : <Circle aria-hidden="true" size={16} />}
                            {ok ? 'Passed' : 'Pending'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Mission Readiness" icon={Rocket}>
          <p className={`ready-state ${ready ? 'is-ready' : ''}`}>
            {ready ? <CircleCheck aria-hidden="true" size={28} /> : <Circle aria-hidden="true" size={28} />}
            <span>{ready ? 'Ready' : 'Not Ready'}</span>
          </p>
          {['d1', 'd2'].map((id) => {
            const pct = readinessPercent(setup[id])
            return (
              <div key={id} className="ready-row">
                <QuadIcon size={22} className="brand-ico" />
                <span>{NAMES[id]}</span>
                <div className="ready-bar" role="progressbar" aria-label={`${NAMES[id]} readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <span className="bar"><span style={{ width: `${pct}%` }} /></span>
                  <strong className="tabular">{pct}%</strong>
                </div>
              </div>
            )
          })}
        </Panel>
      </div>
    </div>
  )
}

export default memo(Setup)
