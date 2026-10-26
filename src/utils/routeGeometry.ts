import L from 'leaflet';

/**
 * Finds the closest point and segment index on a polyline given a mouse coordinate.
 * Uses screen pixel projection at current map zoom for exact visual accuracy.
 */
export function findClosestPointOnPolyline(
  map: L.Map,
  polyline: L.Polyline,
  latlng: L.LatLng
): { index: number; snappedLatLng: L.LatLng; distancePx: number } | null {
  const rawLatLngs = polyline.getLatLngs();
  const flat: L.LatLng[] = Array.isArray(rawLatLngs[0])
    ? (rawLatLngs as any).flat(Infinity)
    : (rawLatLngs as L.LatLng[]);

  if (!flat || flat.length < 2) return null;

  const clickPt = map.latLngToLayerPoint(latlng);
  let minDistanceSq = Infinity;
  let bestIndex = 1;
  let bestLatLng = flat[0];

  for (let i = 0; i < flat.length - 1; i++) {
    const p1 = map.latLngToLayerPoint(flat[i]);
    const p2 = map.latLngToLayerPoint(flat[i + 1]);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((clickPt.x - p1.x) * dx + (clickPt.y - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const distSq = (clickPt.x - projX) * (clickPt.x - projX) + (clickPt.y - projY) * (clickPt.y - projY);

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestIndex = i + 1;
      bestLatLng = map.layerPointToLatLng(L.point(projX, projY));
    }
  }

  return {
    index: bestIndex,
    snappedLatLng: bestLatLng,
    distancePx: Math.sqrt(minDistanceSq),
  };
}

/**
 * Inserts a LatLng vertex into a polyline at the optimal segment position.
 * Returns the inserted LatLng and new vertex index.
 */
export function insertVertex(
  map: L.Map,
  polyline: L.Polyline,
  clickLatLng: L.LatLng
): { insertedLatLng: L.LatLng; index: number } | null {
  const match = findClosestPointOnPolyline(map, polyline, clickLatLng);
  if (!match) return null;

  const rawLatLngs = polyline.getLatLngs();
  if (Array.isArray(rawLatLngs[0])) {
    const flat: L.LatLng[] = (rawLatLngs as any).flat(Infinity);
    flat.splice(match.index, 0, match.snappedLatLng);
    polyline.setLatLngs(flat);
  } else {
    const latlngs = [...(rawLatLngs as L.LatLng[])];
    latlngs.splice(match.index, 0, match.snappedLatLng);
    polyline.setLatLngs(latlngs);
  }

  return {
    insertedLatLng: match.snappedLatLng,
    index: match.index,
  };
}
