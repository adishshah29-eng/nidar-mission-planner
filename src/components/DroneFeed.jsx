import { toLatLng, dist } from '../lib/geo'
import { SCENE } from '../lib/scene'

// Simulated downward camera: satellite tiles centred on the drone with the aerial photo laid on top,
// plus detection boxes drawn where the simulator has located survivors.
const Z = 18
const TILE = 256
const VIEW_RADIUS = 90
const TILE_URL = (x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`

function tileXY([lat, lng]) {
  const n = 2 ** Z
  const r = (lat * Math.PI) / 180
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n }
}

export function DroneFeed({ name, drone, home, survivors, deliverTarget }) {
  const c = tileXY(toLatLng(home, drone.pos))
  const fx = Math.floor(c.x)
  const fy = Math.floor(c.y)
  const tiles = []
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push([fx + dx, fy + dy])
  const offset = (p) => {
    const t = tileXY(toLatLng(home, p))
    return { left: (t.x - c.x) * TILE, top: (t.y - c.y) * TILE }
  }
  const { xmin, xmax, ymin, ymax } = SCENE.bounds
  const nw = offset({ x: xmin, y: ymax })
  const se = offset({ x: xmax, y: ymin })
  const seen = survivors.filter((v) => v.status !== 'hidden' && dist(v.pos, drone.pos) < VIEW_RADIUS)

  return (
    <div className="feed" role="img" aria-label={`${name} simulated camera view${seen.length ? `, ${seen.length} person detected` : ''}`}>
      <div className="feed-tiles">
        {tiles.map(([x, y]) => (
          <img key={`${x}-${y}`} src={TILE_URL(x, y)} alt="" draggable="false" style={{ left: (x - c.x) * TILE, top: (y - c.y) * TILE }} />
        ))}
        <img className="feed-photo" src={SCENE.src} alt="" draggable="false" style={{ left: nw.left, top: nw.top, width: se.left - nw.left, height: se.top - nw.top }} />
        {seen.map((v) => (
          <div key={v.id} className="det-box" style={offset(v.pos)}>
            <span className="det-label">Human {v.conf.toFixed(2)}</span>
            {deliverTarget === v.id && <span className="det-payload">Payload</span>}
          </div>
        ))}
      </div>
      <div className="feed-reticle" aria-hidden="true" />
    </div>
  )
}
