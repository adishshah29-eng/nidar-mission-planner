import L from 'leaflet'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'

const LAYERS = {
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
  Streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
}
export const MAP_LAYERS = Object.keys(LAYERS)

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export function MapBase({ center, zoom = 15, layer = 'Satellite', onClick, children, label }) {
  const tiles = LAYERS[layer] ?? LAYERS.Satellite
  return (
    <div className="map-wrap" role="region" aria-label={label}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="map">
        <TileLayer key={layer} url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
        {onClick && <ClickHandler onClick={onClick} />}
        {children}
      </MapContainer>
    </div>
  )
}

// Marker html goes in via innerHTML, so only known class names and labels may reach it.
const TONES = ['d1', 'd2', 'hidden', 'pending', 'delivering', 'delivered']
const DRONE_LABELS = ['D1', 'D2']
const tone = (t) => (TONES.includes(t) ? t : 'unknown')
const droneLabel = (l) => (DRONE_LABELS.includes(l) ? l : '?')
// Same icon object for the same look, so react-leaflet does not swap the DOM node every tick.
const cache = new Map()
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

export const icons = {
  home: L.divIcon({ className: 'mk-wrap', html: '<div class="mk mk-home">H</div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
  drone: (label, t) => cached(`d:${droneLabel(label)}:${tone(t)}`, () => L.divIcon({ className: 'mk-wrap', html: `<div class="mk mk-drone mk-${tone(t)}">${droneLabel(label)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] })),
  survivor: (t) => cached(`s:${tone(t)}`, () => L.divIcon({ className: 'mk-wrap', html: `<div class="mk mk-survivor mk-${tone(t)}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] })),
  waypoint: (n) => {
    const k = Math.trunc(Number(n)) || 0
    return cached(`w:${k}`, () => L.divIcon({ className: 'mk-wrap', html: `<div class="mk mk-wp">${k}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }))
  },
}
