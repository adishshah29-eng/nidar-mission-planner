// Test double for react-leaflet: jsdom cannot draw maps, so markers render as
// labelled divs and map event handlers are exposed for tests to call.
export const mapHandlers = {}

export const mapRenders = { count: 0 }
export const MapContainer = ({ children }) => {
  mapRenders.count++
  return <div data-testid="map">{children}</div>
}
export const TileLayer = () => null
export const ImageOverlay = ({ url, bounds }) => <img data-testid="image-overlay" src={url} data-bounds={JSON.stringify(bounds)} alt="" />
export const Polygon = ({ children }) => <>{children}</>
export const Polyline = () => null
export const Circle = () => null
export const Tooltip = ({ children }) => <span>{children}</span>
export const Marker = ({ title, children }) => (
  <div data-testid="marker" aria-label={title}>
    {children}
  </div>
)
export function useMapEvents(handlers) {
  Object.assign(mapHandlers, handlers)
  return null
}
export function useMap() {
  return { setView() {}, flyTo() {}, getCenter: () => ({ lat: 0, lng: 0 }) }
}
