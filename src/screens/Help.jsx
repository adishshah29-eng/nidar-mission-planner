import { memo } from 'react'
import { PageHeader } from '../components/ui'

const TOPICS = [
  ['Mission', 'Watch both drones live. Start, pause or reset the simulated mission; detections, payloads and stages update as it runs.'],
  ['Plan', 'Click the satellite map to add waypoints, edit coordinates in the table, and save or load the plan as a .json file.'],
  ['Setup', 'Connect each drone, then calibrate it. The checklist and readiness bars show what is still pending before the mission can start.'],
  ['Configuration', 'Planner settings such as units and telemetry rates, plus the full parameter list (load a preset or a saved file).'],
  ['Simulation', 'Choose the home point, speed and vehicle type, then start a simulated swarm. You are taken to the Mission dashboard.'],
  ['Reports', 'Per-drone analytics for the current mission, totals across every past mission, and a history of each run (finished, or reset part-way).'],
]

function Help() {
  return (
    <div className="help">
      <PageHeader title="Help" subtitle="How each section of Solder & Forget RescueSwarm works." />
      <dl className="help-list">
        {TOPICS.map(([t, d]) => (
          <div key={t}>
            <dt><a href={`#/${t.toLowerCase()}`}>{t}</a></dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">This demo has no backend: everything is saved in this browser. Clearing site data resets the app.</p>
    </div>
  )
}

export default memo(Help)
