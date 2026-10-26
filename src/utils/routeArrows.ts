import L from 'leaflet';
import { calculateHaversineDistance } from './geoJsonStorage';

/**
 * Calculates forward azimuth / bearing in degrees (0..360) from (lat1, lng1) to (lat2, lng2).
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Creates a directional navigation arrow divIcon oriented along the bearing angle.
 * Supports both single direction (arrowhead pointing forward) and bidirectional (double-ended).
 */
export function createArrowIcon(color: string, bearing: number, isBidirectional = false) {
  if (isBidirectional) {
    return L.divIcon({
      className: 'route-direction-arrow-icon',
      html: `<div style="
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${Math.round(bearing)}deg);
        pointer-events: none;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 3px rgba(0,0,0,0.85)); display: block;">
          <path d="M12 2 L17.5 7.5 L13.5 6.5 L13.5 17.5 L17.5 16.5 L12 22 L6.5 16.5 L10.5 17.5 L10.5 6.5 L6.5 7.5 Z" fill="${color}" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round" />
        </svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  return L.divIcon({
    className: 'route-direction-arrow-icon',
    html: `<div style="
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${Math.round(bearing)}deg);
      pointer-events: none;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 3px rgba(0,0,0,0.85)); display: block;">
        <path d="M12 3 L19.5 15.5 L12 12 L4.5 15.5 Z" fill="${color}" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round" />
      </svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Generates directional arrow markers along a polyline's segments.
 */
export function generatePolylineArrows(
  layer: L.Polyline,
  color: string,
  forceBidirectional?: boolean
): L.Marker[] {
  const latlngs = layer.getLatLngs();
  const flat: L.LatLng[] = Array.isArray(latlngs[0])
    ? (latlngs as any).flat(Infinity)
    : (latlngs as L.LatLng[]);

  if (!flat || flat.length < 2) return [];

  const isPolygon =
    layer instanceof L.Polygon ||
    (layer as any).feature?.geometry?.type === 'Polygon' ||
    (layer as any).feature?.geometry?.type === 'MultiPolygon' ||
    Boolean((layer as any).pm?.getShape && (layer as any).pm.getShape().includes('Polygon'));

  const isBidirectional =
    typeof forceBidirectional === 'boolean'
      ? forceBidirectional
      : Boolean((layer as any).feature?.properties?.bidirectional);

  const segmentsCount = isPolygon ? flat.length : flat.length - 1;
  const markers: L.Marker[] = [];

  for (let i = 0; i < segmentsCount; i++) {
    const p1 = flat[i];
    const p2 = flat[(i + 1) % flat.length];
    if (!p1 || !p2) continue;

    const distMeters = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1000;
    if (distMeters < 8) continue; // Skip microscopic segments

    const bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);

    // Dynamic density: 1 arrow for short segments, up to 5 for long segments
    const count = distMeters < 100 ? 1 : Math.min(5, Math.max(2, Math.floor(distMeters / 100)));

    for (let step = 1; step <= count; step++) {
      const t = step / (count + 1);
      const lat = p1.lat + t * (p2.lat - p1.lat);
      const lng = p1.lng + t * (p2.lng - p1.lng);

      const marker = L.marker([lat, lng], {
        icon: createArrowIcon(color, bearing, isBidirectional),
        interactive: false,
        pmIgnore: true,
        arrowColor: color,
        arrowBearing: bearing,
        arrowBidirectional: isBidirectional,
      } as any);

      markers.push(marker);
    }
  }

  return markers;
}
