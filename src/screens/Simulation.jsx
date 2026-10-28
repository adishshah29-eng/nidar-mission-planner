import { memo, useState } from 'react'
import { Marker } from 'react-leaflet'
import { MapPin, Settings2, Layers, Plane, Car, Drone, Helicopter, Play } from 'lucide-react'
import { Panel, PageHeader, NumberField, SelectField } from '../components/ui'
import { MapBase, icons } from '../components/MapBase'

const VEHICLES = [['Plane', Plane], ['Rover', Car], ['Multirotor', Drone], ['Helicopter', Helicopter]]

function Simulation({ simSettings, setSimSettings, onLaunch }) {
  const [speedError, setSpeedError] = useState(null)
  const set = (key) => (v) => setSimSettings((s) => ({ ...s, [key]: v }))
  const { home } = simSettings

  return (
    <div className="simulation">
      <PageHeader title="Simulation" subtitle="Pick a home point and vehicle, then launch a simulated two-drone swarm." />
      <Panel title="Simulation Home Location" icon={MapPin}>
        <div className="sim-map">
          <MapBase center={[home.lat, home.lng]} zoom={15} label="Simulation home map" onClick={(ll) => set('home')({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) })}>
            <Marker position={[home.lat, home.lng]} icon={icons.home} title="Simulation home" />
          </MapBase>
        </div>
        <p className="hint">Click the map to move home. Current: <strong className="tabular">{home.lat.toFixed(6)}, {home.lng.toFixed(6)}</strong></p>
      </Panel>

      <Panel title="Simulation Parameters" icon={Settings2}>
        <div className="sim-params">
          <NumberField label="Simulation speed (x)" value={simSettings.speed} min={1} max={20} onCommit={set('speed')} onDraftError={setSpeedError} />
          <SelectField label="Firmware version" value={simSettings.firmware} options={['Latest (Dev)', 'Stable 4.6', 'Stable 4.5']} onChange={set('firmware')} />
          <SelectField label="Link mode" value={simSettings.link} options={['Multilink', 'Single link']} onChange={set('link')} />
        </div>
      </Panel>

      <Panel title="Select Vehicle Type" icon={Layers}>
        <fieldset className="vehicle-picker">
          <legend className="visually-hidden">Vehicle type</legend>
          {VEHICLES.map(([name, Icon]) => (
            <label key={name} className={`vehicle ${simSettings.vehicle === name ? 'is-selected' : ''}`}>
              <input type="radio" name="vehicle" value={name} checked={simSettings.vehicle === name} onChange={() => set('vehicle')(name)} className="visually-hidden" />
              <Icon aria-hidden="true" size={56} strokeWidth={1.5} />
              <span>{name}</span>
            </label>
          ))}
        </fieldset>
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-lg" disabled={Boolean(speedError)} onClick={() => onLaunch({ home, speed: simSettings.speed })}>
            <Play aria-hidden="true" size={20} />Start {simSettings.vehicle} swarm
          </button>
        </div>
      </Panel>
    </div>
  )
}

export default memo(Simulation)
