// The aerial photo the swarm searches, placed in the sim's metre frame (x east, y north of home).
// shortcut: scaled to ~0.84 m/px so one photo covers the whole search area; people look larger than real.
const M_PER_PX = 0.84
const WIDTH_PX = 1672
const HEIGHT_PX = 941
const SOUTH_EDGE = 30 // home sits just south of the photo so nobody stands on the launch pad

export const SCENE = {
  src: '/search-area.webp',
  widthPx: WIDTH_PX,
  heightPx: HEIGHT_PX,
  bounds: {
    xmin: -(WIDTH_PX * M_PER_PX) / 2,
    xmax: (WIDTH_PX * M_PER_PX) / 2,
    ymin: SOUTH_EDGE,
    ymax: SOUTH_EDGE + HEIGHT_PX * M_PER_PX,
  },
}

export const pxToM = (px, py) => ({ x: SCENE.bounds.xmin + px * M_PER_PX, y: SCENE.bounds.ymax - py * M_PER_PX })

// Pixel centre of each person in search-area.webp, marked by hand.
export const PEOPLE = [
  { px: 250, py: 178, conf: 0.96 }, // yellow shirt, waving
  { px: 571, py: 165, conf: 0.94 }, // blue shirt, sitting
  { px: 1437, py: 128, conf: 0.93 }, // red shirt, on the roof
  { px: 1020, py: 420, conf: 0.91 }, // grey shirt, sitting on the fallen tree
  { px: 815, py: 512, conf: 0.97 }, // navy shirt, waving on the road
  { px: 200, py: 640, conf: 0.95 }, // blue shirt, lying down
  { px: 655, py: 805, conf: 0.94 }, // white shirt, sitting
  { px: 1185, py: 688, conf: 0.95 }, // pink shirt, sitting
  { px: 1581, py: 555, conf: 0.92 }, // navy shirt, lying in the grass
]
