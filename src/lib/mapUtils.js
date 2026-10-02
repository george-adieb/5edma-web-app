/**
 * mapUtils.js
 * Shared map helpers used by FollowUpMapPage and LocationPickerModal.
 *
 * Coordinate system note:
 *   Leaflet uses [lat, lng].
 *   All helpers in this file return { lat, lng } objects or [lat, lng] tuples
 *   according to the documented return shape.
 */

// ─── Default center: Sidi Bishr, Alexandria ───────────────────────────────────
export const DEFAULT_MAP_CENTER = {
  lat:   31.2520,
  lng:   29.9950,
  zoom:  14,
  label: 'سيدي بشر - الإسكندرية',
};

// ─── Geolocation options ──────────────────────────────────────────────────────
export const GEO_OPTIONS = {
  timeout:            8000,
  maximumAge:         60000,
  enableHighAccuracy: false,
};

// ─── Coordinate validator ─────────────────────────────────────────────────────
/**
 * Returns true only when lat/lng are real finite numbers within valid ranges
 * and not the degenerate (0, 0) point.
 */
export function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  if (!isFinite(la) || !isFinite(lo)) return false;
  if (la < -90  || la > 90)  return false;
  if (lo < -180 || lo > 180) return false;
  // Reject (0, 0) — open ocean, useless for this app
  if (la === 0 && lo === 0) return false;
  return true;
}

// ─── Browser geolocation wrapper ─────────────────────────────────────────────
/**
 * Request user's current position once.
 * Returns { lat, lng } on success.
 * Throws an Error with a user-facing Arabic message on failure.
 * Does NOT store the location anywhere.
 */
export function requestUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (isValidCoordinate(latitude, longitude)) {
          resolve({ lat: latitude, lng: longitude });
        } else {
          reject(new Error('الموقع المُستلم غير صالح'));
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('لم يتم السماح بالوصول للموقع، تم فتح الخريطة على سيدي بشر - الإسكندرية.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('انتهت مهلة تحديد الموقع، تم فتح الخريطة على سيدي بشر - الإسكندرية.'));
        } else {
          reject(new Error('تعذّر تحديد الموقع، تم فتح الخريطة على سيدي بشر - الإسكندرية.'));
        }
      },
      GEO_OPTIONS,
    );
  });
}

// ─── Initial view calculator ─────────────────────────────────────────────────
/**
 * Compute the initial map view for a given context.
 *
 * Priority order:
 *   1. Student has saved coordinates → center on student, zoom 16
 *   2. Multiple markers exist        → return bounds for fitBounds
 *   3. Single marker exists          → center on it, zoom 16
 *   4. (caller should try geoloc)    → handled externally; fallback below
 *   5. Default (Sidi Bishr)          → DEFAULT_MAP_CENTER
 *
 * @param {object} params
 * @param {{ latitude, longitude } | null} params.student          — student being edited (or null)
 * @param {Array<{ latitude, longitude }>} params.studentsWithLocations — pre-filtered list
 *
 * @returns {{
 *   center: [number, number],
 *   zoom: number,
 *   bounds: [[number, number], [number, number]] | null
 * }}
 */
export function getInitialMapView({ student = null, studentsWithLocations = [] }) {
  // 1. Student has saved coordinates
  if (student && isValidCoordinate(student.latitude, student.longitude)) {
    return {
      center: [parseFloat(student.latitude), parseFloat(student.longitude)],
      zoom:   16,
      bounds: null,
    };
  }

  // 2/3. Multiple markers → return bounds; single marker → center on it
  const valid = studentsWithLocations.filter(s =>
    isValidCoordinate(s.latitude, s.longitude)
  );

  if (valid.length === 1) {
    return {
      center: [parseFloat(valid[0].latitude), parseFloat(valid[0].longitude)],
      zoom:   16,
      bounds: null,
    };
  }

  if (valid.length > 1) {
    const lats = valid.map(s => parseFloat(s.latitude));
    const lngs = valid.map(s => parseFloat(s.longitude));
    return {
      center: [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ],
      zoom:   12,
      bounds: [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
    };
  }

  // 4/5. No data → fallback (caller should try geolocation before using this)
  return {
    center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
    zoom:   DEFAULT_MAP_CENTER.zoom,
    bounds: null,
  };
}
