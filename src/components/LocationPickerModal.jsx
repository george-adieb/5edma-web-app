/**
 * LocationPickerModal — تحديد موقع السكن
 *
 * UX flow:
 *   1. Search box (Nominatim, free, no API key) biased to Alexandria
 *   2. Results list → click to place marker & zoom
 *   3. Marker is draggable; map click also moves it
 *   4. Map overlay buttons: "الرجوع إلى سيدي بشر" | "استخدام موقعي الحالي" (manual trigger only)
 *   5. Collapsed advanced section: paste Google Maps URL to extract coords
 *   6. Coordinate display + far-from-Alexandria warning
 *   7. Save button → calls onSave(lat, lng) — never saves servant geolocation
 *
 * Privacy:
 *   - Geolocation only used to center map when "استخدام موقعي الحالي" is clicked — never saved
 *   - Only student lat/lng is written to DB via onSave
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Save, MapPin, Loader2, LocateFixed, Search, ChevronDown, ChevronUp, Link } from 'lucide-react';
import {
  DEFAULT_MAP_CENTER,
  isValidCoordinate,
  requestUserLocation,
  getInitialMapView,
} from '../lib/mapUtils';

// ─── Fix Leaflet default icon paths ──────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Custom draggable red pin ─────────────────────────────────────────────────
const redIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <filter id="dropshadow">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.28"/>
    </filter>
    <path filter="url(#dropshadow)" fill="#8B1A1A" stroke="white" stroke-width="2.2"
      d="M16 2C9.925 2 5 6.925 5 13c0 8.5 11 27 11 27s11-18.5 11-27C27 6.925 22.075 2 16 2z"/>
    <circle fill="white" cx="16" cy="13" r="5"/>
  </svg>`,
  className: '',
  iconSize:   [32, 42],
  iconAnchor: [16, 42],
  popupAnchor:[0, -42],
});

// ─── Alexandria bounding box for Nominatim viewbox ───────────────────────────
// viewbox = left,top,right,bottom  (lng_min, lat_max, lng_max, lat_min)
const ALEX_VIEWBOX = '29.70,31.40,30.20,31.10';
// Alexandria center for distance check
const ALEX_CENTER = { lat: 31.2001, lng: 29.9187 };
const FAR_KM_THRESHOLD = 80; // warn if selected point is > 80 km from center of Alex

function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * (Math.PI / 180);
  const dG = (lng2 - lng1) * (Math.PI / 180);
  const a  = Math.sin(dL / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFarFromAlex(lat, lng) {
  return haversineKm(lat, lng, ALEX_CENTER.lat, ALEX_CENTER.lng) > FAR_KM_THRESHOLD;
}

// ─── Nominatim search ─────────────────────────────────────────────────────────
async function searchNominatim(rawQuery) {
  const q = rawQuery.trim();
  if (!q) return [];

  // Append city hint only when user hasn't already typed it
  const hasCity = /إسكندري|اسكندري|alexan/i.test(q);
  const query   = hasCity ? q : `${q} سيدي بشر الإسكندرية مصر`;

  const params = new URLSearchParams({
    q,
    format:          'json',
    addressdetails:  '1',
    limit:           '6',
    countrycodes:    'eg',
    viewbox:         ALEX_VIEWBOX,
    bounded:         '0',        // allow results outside viewbox if nothing found
    'accept-language':'ar',
  });

  // Use the full biased query including city hint
  params.set('q', query);

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { 'Accept-Language': 'ar', 'User-Agent': '5edmaApp/1.0' } }
  );
  if (!res.ok) throw new Error('فشل الاتصال بخدمة البحث');
  return res.json();
}

// ─── Extract coords from a Google Maps / Google search URL ───────────────────
function extractCoordsFromUrl(url) {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /maps\?.*center=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

// ─── Inner: click handler ─────────────────────────────────────────────────────
function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ─── Inner: map controller (exposes map instance) ────────────────────────────
function MapController({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

// ─── Overlay map buttons ──────────────────────────────────────────────────────
function MapOverlayButtons({ onGoDefault, onUseMyLocation, geoLoading }) {
  const base = {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '7px 11px', borderRadius: '8px',
    border: '1.5px solid rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.93)',
    fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
    color: '#374151', cursor: 'pointer', direction: 'rtl',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(4px)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{
      position: 'absolute', bottom: '14px', right: '14px',
      zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px',
      alignItems: 'flex-end',
    }}>
      <button style={base} onClick={onGoDefault}
        onMouseEnter={e => e.currentTarget.style.background = 'white'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.93)'}
      >
        <MapPin size={12} color="#8B1A1A" />
        الرجوع إلى سيدي بشر
      </button>
      {navigator.geolocation && (
        <button
          style={{ ...base, opacity: geoLoading ? 0.7 : 1, cursor: geoLoading ? 'wait' : 'pointer' }}
          onClick={onUseMyLocation} disabled={geoLoading}
          onMouseEnter={e => !geoLoading && (e.currentTarget.style.background = 'white')}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.93)'}
        >
          {geoLoading
            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            : <LocateFixed size={12} color="#1D4ED8" />
          }
          {geoLoading ? 'جاري التحديد...' : 'استخدام موقعي الحالي'}
        </button>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function LocationPickerModal({
  isOpen,
  onClose,
  onSave,
  initialLat,
  initialLng,
  studentName,
}) {
  // Core state
  const [pickedLat,    setPickedLat]    = useState(null);
  const [pickedLng,    setPickedLng]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [pickMsg,      setPickMsg]      = useState(null); // {type,text}

  // Search state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError,   setSearchError]   = useState(null);

  // Geolocation
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg,     setGeoMsg]     = useState(null);

  // Advanced section
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [mapsUrl,       setMapsUrl]       = useState('');
  const [urlError,      setUrlError]      = useState(null);

  const mapRef = useRef(null);

  // ── Computed ────────────────────────────────────────────────────────────────
  const hasStudentCoords = isValidCoordinate(initialLat, initialLng);
  const initialView = getInitialMapView({
    student: hasStudentCoords ? { latitude: initialLat, longitude: initialLng } : null,
    studentsWithLocations: [],
  });

  const isFar = pickedLat && pickedLng && isFarFromAlex(pickedLat, pickedLng);

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setPickedLat(hasStudentCoords ? parseFloat(initialLat) : null);
    setPickedLng(hasStudentCoords ? parseFloat(initialLng) : null);
    setSaving(false);
    setPickMsg(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setGeoMsg(null);
    setGeoLoading(false);
    setShowAdvanced(false);
    setMapsUrl('');
    setUrlError(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map ready ───────────────────────────────────────────────────────────────
  const handleMapReady = useCallback((map) => { mapRef.current = map; }, []);

  // ── Pick a coordinate ───────────────────────────────────────────────────────
  const pickCoord = useCallback((lat, lng, msg = null) => {
    setPickedLat(lat);
    setPickedLng(lng);
    if (msg) setPickMsg(msg);
    else setPickMsg(null);
  }, []);

  // ── Nominatim search ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await searchNominatim(searchQuery);
      if (results.length === 0) {
        setSearchError('لم يتم العثور على نتائج. جرب اسم شارع أو حي آخر.');
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError('تعذّر الاتصال بخدمة البحث. تحقق من الإنترنت وحاول مرة أخرى.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleResultPick = useCallback((result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isValidCoordinate(lat, lng)) return;
    pickCoord(lat, lng, {
      type: 'ok',
      text: 'تم اختيار الموقع، يمكنك تحريك العلامة لو المكان محتاج تعديل.',
    });
    mapRef.current?.setView([lat, lng], 17, { animate: true });
    setSearchResults([]); // collapse results
    setSearchQuery('');
  }, [pickCoord]);

  // ── Geolocation (manual trigger only) ──────────────────────────────────────
  const askGeolocation = useCallback(async () => {
    if (geoLoading) return;
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const { lat, lng } = await requestUserLocation();
      mapRef.current?.setView([lat, lng], 15, { animate: true });
      setGeoMsg({
        type: 'ok',
        text: 'تم فتح الخريطة بالقرب من موقعك الحالي. حدد مكان سكن المخدوم ثم اضغط حفظ.',
      });
    } catch (err) {
      mapRef.current?.setView(
        [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
        DEFAULT_MAP_CENTER.zoom,
        { animate: true }
      );
      setGeoMsg({ type: 'warn', text: err.message });
    } finally {
      setGeoLoading(false);
    }
  }, [geoLoading]);

  const goToDefault = useCallback(() => {
    mapRef.current?.setView(
      [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
      DEFAULT_MAP_CENTER.zoom,
      { animate: true }
    );
  }, []);

  // ── Google Maps URL extract ─────────────────────────────────────────────────
  const handleUrlExtract = useCallback(() => {
    setUrlError(null);
    if (!mapsUrl.trim()) { setUrlError('الرجاء لصق رابط Google Maps أولًا.'); return; }
    const coords = extractCoordsFromUrl(mapsUrl.trim());
    if (!coords) {
      setUrlError('لم يتم التعرف على إحداثيات في هذا الرابط. تأكد من أنه رابط Google Maps صحيح.');
      return;
    }
    pickCoord(coords.lat, coords.lng, {
      type: 'ok',
      text: 'تم استخراج الموقع من الرابط. يمكنك تحريك العلامة لتدقيق الموقع.',
    });
    mapRef.current?.setView([coords.lat, coords.lng], 17, { animate: true });
    setMapsUrl('');
    setShowAdvanced(false);
  }, [mapsUrl, pickCoord]);

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!isValidCoordinate(pickedLat, pickedLng)) return;
    setSaving(true);
    try {
      await onSave(pickedLat, pickedLng);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const canSave = isValidCoordinate(pickedLat, pickedLng) && !saving;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.58)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '18px',
        width: '100%', maxWidth: '720px',
        boxShadow: '0 24px 72px rgba(0,0,0,0.32)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '96vh', overflow: 'hidden',
        direction: 'rtl', fontFamily: 'Cairo, sans-serif',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '15px 20px',
          background: 'linear-gradient(135deg,#8B1A1A,#B52626)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
            width: '32px', height: '32px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}><X size={16} /></button>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontWeight: 900, fontSize: '16px', color: 'white', margin: 0 }}>
              تحديد موقع السكن
            </h2>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', margin: 0 }}>
              {studentName}
            </p>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>



          {/* ── Search section removed ─────────────────────────────────────────── */}

          {/* ── Geo / pick message ──────────────────────────────────────── */}
          {(geoMsg || pickMsg) && (() => {
            const msg = pickMsg || geoMsg;
            return (
              <div style={{
                padding: '8px 14px', flexShrink: 0,
                background: msg.type === 'ok' ? '#F0FDF4' : '#FEF9C3',
                borderBottom: `1px solid ${msg.type === 'ok' ? '#BBF7D0' : '#FDE68A'}`,
                display: 'flex', alignItems: 'flex-start', gap: '7px',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>
                  {msg.type === 'ok' ? '✅' : '⚠️'}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600,
                  color: msg.type === 'ok' ? '#166534' : '#92400E', flex: 1,
                }}>{msg.text}</span>
                <button
                  onClick={() => { setPickMsg(null); setGeoMsg(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0 }}
                >×</button>
              </div>
            );
          })()}

          {/* ── Map ─────────────────────────────────────────────────────── */}
          <div style={{ height: '310px', flexShrink: 0, position: 'relative' }}>
            <MapContainer
              center={initialView.center}
              zoom={hasStudentCoords ? 16 : DEFAULT_MAP_CENTER.zoom}
              style={{ height: '100%', width: '100%' }}
              key={`picker-${isOpen}`}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapController onReady={handleMapReady} />
              <ClickHandler onPick={(lat, lng) => {
                pickCoord(lat, lng);
                setPickMsg(null);
              }} />
              {isValidCoordinate(pickedLat, pickedLng) && (
                <Marker
                  position={[pickedLat, pickedLng]}
                  icon={redIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      pickCoord(lat, lng);
                    },
                  }}
                />
              )}
            </MapContainer>

            <MapOverlayButtons
              onGoDefault={goToDefault}
              onUseMyLocation={askGeolocation}
              geoLoading={geoLoading}
            />
          </div>

          {/* ── Coordinate display + far warning ───────────────────────── */}
          <div style={{ padding: '10px 14px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            {isValidCoordinate(pickedLat, pickedLng) ? (
              <>
                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 5px', fontWeight: 600 }}>
                  الموقع المحدد:
                  <span style={{ fontWeight: 800, color: '#374151', direction: 'ltr', display: 'inline-block', marginRight: '4px' }}>
                    {Number(pickedLat).toFixed(6)}, {Number(pickedLng).toFixed(6)}
                  </span>
                </p>
                {isFar && (
                  <p style={{
                    fontSize: '11px', color: '#92400E', fontWeight: 700,
                    margin: '4px 0 0', padding: '6px 10px',
                    background: '#FEF9C3', borderRadius: '7px', border: '1px solid #FDE68A',
                  }}>
                    ⚠️ الموقع بعيد عن نطاق الخدمة المعتاد، تأكد أنه صحيح قبل الحفظ.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, fontWeight: 600, textAlign: 'center' }}>
                لم يتم تحديد موقع بعد — ابحث عن مكان أو اضغط على الخريطة مباشرة
              </p>
            )}
          </div>

          {/* ── Advanced: paste Google Maps URL ───────────────────────── */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #F3F4F6' }}>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{
                width: '100%', padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'white', border: 'none', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                color: '#6B7280', direction: 'rtl',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link size={13} />
                طريقة متقدمة: لصق رابط Google Maps
              </span>
            </button>

            {showAdvanced && (
              <div style={{
                padding: '12px 14px 14px',
                background: '#F9FAFB', borderTop: '1px solid #F3F4F6',
              }}>
                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 8px', fontWeight: 600 }}>
                  افتح Google Maps على موقع سكن المخدوم، انسخ رابط الصفحة، والصقه هنا:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleUrlExtract}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', flexShrink: 0,
                      background: '#374151', color: 'white', border: 'none',
                      fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    استخراج الموقع
                  </button>
                  <input
                    value={mapsUrl}
                    onChange={e => { setMapsUrl(e.target.value); setUrlError(null); }}
                    placeholder="https://maps.google.com/..."
                    style={{
                      flex: 1, padding: '8px 12px',
                      border: '1.5px solid #E5E7EB', borderRadius: '8px',
                      fontFamily: 'monospace', fontSize: '12px',
                      direction: 'ltr', color: '#374151', outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                {urlError && (
                  <p style={{
                    fontSize: '11px', color: '#DC2626', fontWeight: 600,
                    margin: '6px 0 0',
                  }}>⚠️ {urlError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 16px', borderTop: '2px solid #F3F4F6',
          display: 'flex', justifyContent: 'space-between', gap: '10px',
          flexShrink: 0, background: 'white',
        }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '9px',
            background: 'white', border: '1.5px solid #E5E7EB',
            fontFamily: 'Cairo, sans-serif', fontSize: '13px',
            fontWeight: 700, color: '#374151', cursor: 'pointer',
          }}>إلغاء</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '10px 26px', borderRadius: '9px',
              background: canSave ? 'linear-gradient(135deg,#8B1A1A,#B52626)' : '#D1D5DB',
              color: 'white', border: 'none',
              fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '7px',
              boxShadow: canSave ? '0 4px 14px rgba(139,26,26,0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {saving
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />جاري الحفظ...</>
              : <><Save size={14} />حفظ موقع السكن</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
