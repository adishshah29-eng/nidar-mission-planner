// Local flat-earth frame in metres (x east, y north) around a home point.
// shortcut: equirectangular approximation, fine for a few km; use a proper projection for larger areas.
const M_PER_DEG = 111320

export function toLatLng(home, { x, y }) {
  return [home.lat + y / M_PER_DEG, home.lng + x / (M_PER_DEG * Math.cos((home.lat * Math.PI) / 180))]
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
