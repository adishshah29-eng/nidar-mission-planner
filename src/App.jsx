import { useCallback, useEffect } from 'react'
import { Crosshair, Map, Settings, SlidersHorizontal, MonitorPlay, ChartColumn, CircleHelp, Link, Unlink, Clock, Wifi } from 'lucide-react'
import { QuadIcon } from './components/ui'
import { useHashRoute, usePersistentState, useSimulation, useMissionHistory, useNow, navigate } from './lib/hooks'
import { CONFIG_DEFAULTS, sanitizeConfig } from './lib/config'
import { disconnectedDrone, connectDrone, disconnect, sanitizeDrone } from './lib/readiness'
import { HOME } from './lib/waypoints'
import Mission from './screens/Mission'
import Plan from './screens/Plan'
import Setup from './screens/Setup'
import Configuration from './screens/Configuration'
import Simulation from './screens/Simulation'
import Report from './screens/Report'
import Help from './screens/Help'

const NAV = [
  ['mission', 'Mission', Crosshair],
  ['plan', 'Plan', Map],
  ['setup', 'Setup', Settings],
  ['configuration', 'Configuration', SlidersHorizontal],
  ['simulation', 'Simulation', MonitorPlay],
  ['reports', 'Reports', ChartColumn],
  ['help', 'Help', CircleHelp],
]

const SIM_DEFAULTS = { home: { lat: HOME.lat, lng: HOME.lng }, speed: 5, firmware: 'Latest (Dev)', link: 'Multilink', vehicle: 'Multirotor' }
const VEHICLES = ['Plane', 'Rover', 'Multirotor', 'Helicopter']

function sanitizeSimSettings(s) {
  const out = { ...SIM_DEFAULTS, ...(s && typeof s === 'object' ? s : {}) }
  const h = out.home
  if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lng) || Math.abs(h.lat) > 85 || Math.abs(h.lng) > 180) out.home = SIM_DEFAULTS.home
  if (!Number.isInteger(out.speed) || out.speed < 1 || out.speed > 20) out.speed = SIM_DEFAULTS.speed
  if (!VEHICLES.includes(out.vehicle)) out.vehicle = SIM_DEFAULTS.vehicle
  return out
}

const SETUP_DEFAULTS = () => ({ d1: disconnectedDrone('search'), d2: disconnectedDrone('delivery') })
const sanitizeSetup = (s) => ({ d1: sanitizeDrone(s?.d1, 'search'), d2: sanitizeDrone(s?.d2, 'delivery') })

// Own component so the 1-second tick only redraws the clock, not the whole app.
function TopClock() {
  const now = useNow()
  return <time>{now.toLocaleTimeString('en-GB')}</time>
}

const STATUS_TEXT = { running: 'LIVE', paused: 'PAUSED', idle: 'IDLE', complete: 'COMPLETE' }

export default function App() {
  const route = useHashRoute()
  const [section, sub = ''] = route.split('/')
  const active = NAV.some(([p]) => p === section) ? section : 'mission'
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  const [setup, setSetup] = usePersistentState('setup', SETUP_DEFAULTS, sanitizeSetup)
  const [config, setConfig] = usePersistentState('config', CONFIG_DEFAULTS, sanitizeConfig)
  const [simSettings, setSimSettings] = usePersistentState('simSettings', SIM_DEFAULTS, sanitizeSimSettings)
  const simCtl = useSimulation({ home: simSettings.home, speed: simSettings.speed })
  const [history, clearHistory] = useMissionHistory(simCtl.sim)

  const linked = [setup.d1, setup.d2].filter((d) => d.connected).length
  const allLinked = linked === 2
  const toggleAll = () =>
    setSetup((s) => (allLinked ? { d1: disconnect(s.d1), d2: disconnect(s.d2) } : { d1: s.d1.connected ? s.d1 : connectDrone(s.d1), d2: s.d2.connected ? s.d2 : connectDrone(s.d2) }))

  const { launch } = simCtl
  const onLaunch = useCallback(
    (opts) => {
      launch(opts)
      navigate('mission')
    },
    [launch],
  )

  let page
  if (active === 'plan') page = <Plan />
  else if (active === 'setup') page = <Setup setup={setup} setSetup={setSetup} />
  else if (active === 'configuration') page = <Configuration sub={sub} config={config} setConfig={setConfig} />
  else if (active === 'simulation')
    page = (
      <Simulation
        simSettings={simSettings}
        setSimSettings={setSimSettings}
        onLaunch={onLaunch}
      />
    )
  else if (active === 'reports') page = <Report sim={simCtl.sim} history={history} onClear={clearHistory} config={config} />
  else if (active === 'help') page = <Help />
  else page = <Mission simCtl={simCtl} config={config} simSettings={simSettings} setup={setup} />

  const status = simCtl.sim.status

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#/mission" aria-label="Solder & Forget RescueSwarm home">
          <QuadIcon size={34} />
          <span className="brand-text"><strong>Solder &amp; Forget</strong><span>RescueSwarm</span></span>
        </a>
        <nav className="main-nav" aria-label="Main">
          {NAV.map(([path, label, Icon]) => (
            <a key={path} href={`#/${path}`} aria-current={active === path ? 'page' : undefined}>
              <Icon aria-hidden="true" size={22} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="topbar-status">
          <span className={`chip chip-${status}`}>
            <span className="dot" aria-hidden="true" />{STATUS_TEXT[status]}
          </span>
          <span className="chip"><Wifi aria-hidden="true" size={16} />{linked}/2 linked</span>
          <span className="chip tabular"><Clock aria-hidden="true" size={16} /><TopClock /></span>
          <button type="button" className={`btn ${allLinked ? '' : 'btn-primary'}`} aria-label={allLinked ? 'Disconnect all drones' : 'Connect all drones'} onClick={toggleAll}>
            {allLinked ? <Unlink aria-hidden="true" size={18} /> : <Link aria-hidden="true" size={18} />}
            {allLinked ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{page}</main>
    </div>
  )
}
