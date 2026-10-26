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
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${Math.round(bearing)}deg);
        pointer-events: none;
      ">
        <svg width="24" height="24" viewBox="0 0 26 26" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.75)); display: block;">
          <!-- Crisp white double-arrow body with dark high-contrast outline -->
          <path d="M 13 1.5 L 20 8.5 L 15 7.5 L 15 18.5 L 20 17.5 L 13 24.5 L 6 17.5 L 11 18.5 L 11 7.5 L 6 8.5 Z" 
                fill="#ffffff" 
                stroke="#0f172a" 
                stroke-width="1.8" 
                stroke-linejoin="round" />
          <!-- Inner route-colored core -->
          <path d="M 13 4.5 L 17 8.5 L 13.5 7.8 L 13.5 18.2 L 17 17.5 L 13 21.5 L 9 17.5 L 12.5 18.2 L 12.5 7.8 L 9 8.5 Z" 
                fill="${color}" />
        </svg>
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

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
      <svg width="22" height="22" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.75)); display: block;">
        <!-- Crisp white aerodynamic body with dark high-contrast outline -->
        <path d="M 12 2 L 20.5 15.5 L 14.5 13 L 12 10 L 9.5 13 L 3.5 15.5 Z" 
              fill="#ffffff" 
              stroke="#0f172a" 
              stroke-width="1.8" 
              stroke-linejoin="round" />
        <!-- Inner route-colored core -->
        <path d="M 12 5 L 17.5 14 L 13.5 12.3 L 12 10.5 L 10.5 12.3 L 6.5 14 Z" 
              fill="${color}" />
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
    if (distMeters < 12) continue; // Skip microscopic segments to prevent clutter

    const bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);

    // Clean spacing: exactly 1 arrow for segments under 140m, up to 4 for very long segments
    const count = distMeters < 140 ? 1 : Math.min(4, Math.max(2, Math.floor(distMeters / 140)));

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
