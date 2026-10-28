import { memo, useState } from 'react'
import { History, CircleCheck, CircleX, Users, Package, Clock, LayoutGrid, Trash2, ChartColumn } from 'lucide-react'
import { Panel, PageHeader, Stat } from '../components/ui'
import { aggregate, summarizeRun } from '../lib/history'
import { formatClock } from '../lib/simEngine'
import { fmtDistance } from '../lib/config'

const NAMES = { d1: 'Drone 01', d2: 'Drone 02' }
const NONE = '—'
const when = (at) => new Date(at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const clock = (t) => (t === null ? NONE : formatClock(t))

function ClearButton({ onClear }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="btn" onClick={() => setAsking(true)}>
        <Trash2 aria-hidden="true" size={18} />Clear history
      </button>
    )
  }
  return (
    <span className="btn-row">
      <button type="button" className="btn btn-primary" onClick={() => { setAsking(false); onClear() }}>Confirm clear</button>
      <button type="button" className="btn" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  )
}

function Report({ sim, history, onClear, config }) {
  const all = aggregate(history)
  const live = sim.status === 'idle' ? null : summarizeRun(sim)
  const ids = ['d1', 'd2']
  const pct = (n) => (n === null ? NONE : `${n.toFixed(1)}%`)

  // Each row: label, this-mission value per drone, all-missions value per drone.
  const rows = [
    ['Distance searched', (d) => fmtDistance(d.searchedM, config), (d) => fmtDistance(d.searchedM, config)],
    ['Battery left', (d) => `${d.battery}%`, (d) => pct(d.avgBattery)],
    ['Survivors detected', (d) => d.detections, (d) => d.detections],
    ['Payloads delivered', (d) => d.deliveries, (d) => d.deliveries],
    ['Low-battery returns', (d) => (d.lowBattery ? 'Yes' : 'No'), (d) => d.lowBattery],
  ]

  return (
    <div className="report">
      <PageHeader title="Reports" subtitle="Analytics for both drones, this mission and every mission before it.">
        {history.length > 0 && <ClearButton onClear={onClear} />}
      </PageHeader>

      <div className="stats">
        <Stat icon={History} label="Missions" value={String(all.missions)} />
        <Stat icon={CircleCheck} label="Completed" value={String(all.completed)} />
        <Stat icon={Users} label="Survivors found" value={String(all.found)} />
        <Stat icon={Package} label="Payloads delivered" value={String(all.delivered)} />
        <Stat icon={Clock} label="Average duration" value={clock(all.avgDuration === null ? null : Math.round(all.avgDuration))} />
        <Stat icon={LayoutGrid} label="Average area searched" value={pct(all.avgArea)} />
        <Stat icon={CircleX} label="Aborted" value={String(all.aborted)} />
      </div>

      <Panel title="Drone Analytics" icon={ChartColumn}>
        <div className="table-wrap">
          <table className="table" aria-label="Drone analytics">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {ids.map((id) => <th key={`l${id}`} scope="col">{NAMES[id]} · this mission</th>)}
                {ids.map((id) => <th key={`a${id}`} scope="col">{NAMES[id]} · all missions</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, now, total]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {ids.map((id) => <td key={`l${id}`}>{live ? now(live.drones[id]) : NONE}</td>)}
                  {ids.map((id) => <td key={`a${id}`}>{history.length ? total(all.drones[id]) : NONE}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          {live ? 'This mission is the one on the Mission screen.' : 'Start a mission to fill in the this-mission columns.'} Battery for all missions is the average left at the end.
        </p>
      </Panel>

      <Panel title="Mission History" icon={History}>
        {history.length === 0 ? (
          <p className="empty">No missions recorded yet. A mission is saved here when it finishes, or when you reset it part-way.</p>
        ) : (
          <div className="table-wrap">
            <table className="table" aria-label="Mission history">
              <thead>
                <tr>
                  {['Date', 'Outcome', 'Duration', 'Speed', 'Survivors', 'Payloads', 'Area searched', 'D1 battery', 'D2 battery'].map((h) => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.at)}</td>
                    <td><span className={`badge ${r.outcome === 'complete' ? 'badge-ok' : 'badge-off'}`}>{r.outcome === 'complete' ? 'Complete' : 'Aborted'}</span></td>
                    <td>{formatClock(r.t)}</td>
                    <td>{r.speed}x</td>
                    <td>{r.found}</td>
                    <td>{r.delivered} / {r.total}</td>
                    <td>{r.areaPct.toFixed(1)}%</td>
                    <td>{r.drones.d1.battery}%</td>
                    <td>{r.drones.d2.battery}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default memo(Report)
