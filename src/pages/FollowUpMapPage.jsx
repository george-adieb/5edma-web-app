/**
 * FollowUpMapPage — خريطة الافتقاد
 *
 * Behavior:
 * - Cluster click  → side panel with ALL students in that cluster, title "مخدومين في هذه المنطقة"
 * - Marker click   → side panel with that one student,           title "بيانات المخدوم"
 * - Same-coords    → MarkerCluster auto-groups them; cluster click reveals all
 * - Card click     → highlight card, pan/zoom to student, open popup
 * - "تكبير على المنطقة" button → fitBounds on panel students
 * - Overlay buttons → "الرجوع إلى سيدي بشر" / "استخدام موقعي الحالي"
 * - Desktop: side panel beside map | Mobile: bottom sheet
 */
import {
  useState, useEffect, useMemo, useRef, useCallback,
} from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useNavigate } from 'react-router-dom';
import {
  Search, Map as MapIcon, X, Phone, ExternalLink, AlertTriangle,
  MapPin, RefreshCw, LocateFixed, Loader2, ZoomIn, Users, User,
} from 'lucide-react';
import { fetchStudentsForFollowUpMap } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import { GRADES } from '../data/constants';
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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  منتظم:          { bg: '#DCFCE7', color: '#16A34A' },
  جديد:           { bg: '#DBEAFE', color: '#1D4ED8' },
  منقطع:          { bg: '#FEE2E2', color: '#DC2626' },
  'يحتاج افتقاد': { bg: '#FEF3C7', color: '#D97706' },
};
const STATUS_FILTERS = ['الكل', 'منتظم', 'جديد', 'منقطع', 'يحتاج افتقاد'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArabicNumerals(n) {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function getStatusColor(status) {
  return status === 'منتظم'         ? '#16A34A'
       : status === 'جديد'          ? '#1D4ED8'
       : status === 'يحتاج افتقاد' ? '#D97706'
       : status === 'منقطع'         ? '#DC2626'
       : '#8B1A1A';
}

// ─── Unified Marker Icon for single and exact group students ─────────────────
function createStudentCountIcon(count, selected = false) {
  const size = count === 1 ? 34 : count < 10 ? 40 : count < 50 ? 46 : 54;
  const shadow = selected ? `0 0 0 6px rgba(139,26,26,0.25)` : `0 3px 14px rgba(139,26,26,0.45)`;
  const label = count === 1 ? 'مخدوم' : 'مخدومين';
  
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:linear-gradient(135deg,#8B1A1A,#B52626);
      border:3px solid white;
      box-shadow:${shadow};
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      font-family:Cairo,sans-serif;color:white;line-height:1.1;
      cursor:pointer;
      transform: ${selected ? 'scale(1.15)' : 'scale(1)'};
      transition: transform 0.2s;
    ">
      <span style="font-size:${count<10?14:11}px;font-weight:900;">${toArabicNumerals(count)}</span>
      <span style="font-size:8px;font-weight:600;opacity:.85;">${label}</span>
    </div>`,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor:[0, -(size / 2)],
  });
}

// ─── Cluster icon wrapper ─────────────────────────────────────────────────────
function createClusterCustomIcon(cluster) {
  return createStudentCountIcon(cluster.getChildCount());
}

// ─── MapController: exposes map ref + auto-fits on load ──────────────────────
function MapController({ onReady, studentsWithLocation }) {
  const map    = useMap();
  const fitted = useRef(false);

  useEffect(() => { onReady(map); }, [map, onReady]);

  useEffect(() => {
    if (fitted.current || !studentsWithLocation?.length) return;
    fitted.current = true;

    if (studentsWithLocation.length === 1) {
      const s = studentsWithLocation[0];
      map.setView([parseFloat(s.latitude), parseFloat(s.longitude)], 16, { animate: true });
      return;
    }
    const view = getInitialMapView({ studentsWithLocations: studentsWithLocation });
    if (view.bounds) {
      map.fitBounds(view.bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [studentsWithLocation, map]);

  return null;
}

// ─── MapResizeTrigger ─────────────────────────────────────────────────────────
function MapResizeTrigger({ trigger }) {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 310); }, [trigger, map]);
  return null;
}

// ─── Overlay nav buttons ──────────────────────────────────────────────────────
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
      position: 'absolute', bottom: '24px', right: '14px',
      zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px',
      alignItems: 'flex-end',
    }}>
      <button
        style={base}
        onClick={onGoDefault}
        onMouseEnter={e => e.currentTarget.style.background = 'white'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.93)'}
      >
        <MapPin size={12} color="#8B1A1A" />
        الرجوع إلى سيدي بشر
      </button>
      {navigator.geolocation && (
        <button
          style={{ ...base, opacity: geoLoading ? 0.7 : 1, cursor: geoLoading ? 'wait' : 'pointer' }}
          onClick={onUseMyLocation}
          disabled={geoLoading}
          onMouseEnter={e => !geoLoading && (e.currentTarget.style.background = 'white')}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.93)'}
        >
          {geoLoading
            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            : <LocateFixed size={12} color="#1D4ED8" />}
          {geoLoading ? 'جاري التحديد...' : 'استخدام موقعي الحالي'}
        </button>
      )}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{
      fontSize: '11px', padding: '2px 9px', borderRadius: '20px',
      background: cfg.bg, color: cfg.color, fontWeight: 800,
      display: 'inline-block',
    }}>{status}</span>
  );
}

// ─── Student card in side panel ───────────────────────────────────────────────
function StudentPanelCard({ student, isSelected, onSelect, onOpenMaps, onNavigate }) {
  const color = getStatusColor(student.status);

  return (
    <div
      onClick={() => onSelect(student)}
      style={{
        padding: '12px 14px', borderRadius: '11px',
        border: `2px solid ${isSelected ? color : '#E5E7EB'}`,
        background: isSelected ? `${color}08` : 'white',
        marginBottom: '8px', direction: 'rtl', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: isSelected ? `0 0 0 3px ${color}22` : 'none',
      }}
    >
      {/* Name + status row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <StatusBadge status={student.status} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 800, fontSize: '13px', color: '#111827', margin: 0 }}>{student.name}</p>
          <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '1px 0 0' }}>
            {student.code} · {student.grade}
          </p>
        </div>
      </div>

      {/* Phone */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        marginTop: '7px', alignItems: 'flex-end',
      }}>
        {student.parent_phone && (
          <a
            href={`tel:${student.parent_phone}`}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '11px', color: '#8B1A1A', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
            }}
          >
            <span style={{ color: '#4B5563', fontSize: '10px' }}>موبايل المخدوم:</span>
            <span dir="ltr">{student.parent_phone}</span>
            <Phone size={10} />
          </a>
        )}
        {student.parent_phone_2 && (
          <a
            href={`tel:${student.parent_phone_2}`}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '11px', color: '#1D4ED8', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
            }}
          >
            <span style={{ color: '#4B5563', fontSize: '10px' }}>ولي الأمر:</span>
            <span dir="ltr">{student.parent_phone_2}</span>
            <Phone size={10} />
          </a>
        )}
      </div>

      {/* Address */}
      {student.address && (
        <div style={{
          marginTop: '6px', textAlign: 'right',
          background: '#F9FAFB', padding: '6px 8px', borderRadius: '6px',
          border: '1px solid #F3F4F6'
        }}>
          <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
            📍 {student.address}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(student); }}
          style={{
            flex: 1, padding: '6px 8px', borderRadius: '7px',
            background: '#FEF2F2', color: '#8B1A1A',
            border: 'none', fontFamily: 'Cairo, sans-serif',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
          onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}
        >
          <User size={11} />
          ملف المخدوم
        </button>
        {isValidCoordinate(student.latitude, student.longitude) && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMaps(student); }}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: '7px',
              background: '#F0FDF4', color: '#16A34A',
              border: 'none', fontFamily: 'Cairo, sans-serif',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#DCFCE7'}
            onMouseLeave={e => e.currentTarget.style.background = '#F0FDF4'}
          >
            <ExternalLink size={11} />
            خرائط
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Side panel (desktop) / Bottom sheet (mobile) ────────────────────────────
function SidePanel({
  students, title, selectedId, onSelect, onClose,
  onOpenMaps, onNavigate, onZoomToArea,
}) {
  const isMultiple = students.length > 1;

  return (
    <>
      {/* ── Desktop panel (left of map) ── */}
      <div className="followup-panel-desktop" style={{
        width: '310px', flexShrink: 0,
        background: 'white', borderRadius: '14px',
        border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', direction: 'rtl',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg,#8B1A1A,#B52626)',
          flexShrink: 0,
        }}>
          {/* Debug text */}
          <div style={{ background: '#FEF08A', color: '#854D0E', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', textAlign: 'center', marginBottom: '8px', fontWeight: 'bold' }}>
            المعروض في القائمة: {students.length}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.18)', border: 'none',
                borderRadius: '7px', width: '28px', height: '28px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', flexShrink: 0,
              }}
            ><X size={14} /></button>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                {isMultiple
                  ? <Users size={13} color="rgba(255,255,255,0.8)" />
                  : <User  size={13} color="rgba(255,255,255,0.8)" />
                }
                <p style={{ fontWeight: 900, fontSize: '14px', color: 'white', margin: 0 }}>
                  {title}
                </p>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.72)', margin: '2px 0 0' }}>
                عدد المخدومين: {toArabicNumerals(students.length)}
              </p>
            </div>
          </div>

          {/* Zoom-to-area button */}
          {isMultiple && (
            <button
              onClick={onZoomToArea}
              style={{
                marginTop: '10px', width: '100%', padding: '7px 12px',
                borderRadius: '8px', background: 'rgba(255,255,255,0.15)',
                border: '1.5px solid rgba(255,255,255,0.35)',
                color: 'white', fontFamily: 'Cairo, sans-serif',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              <ZoomIn size={12} />
              تكبير على المنطقة
            </button>
          )}
        </div>

        {/* Scrollable card list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px' }}>
          {students.map(s => (
            <StudentPanelCard
              key={s.id}
              student={s}
              isSelected={s.id === selectedId}
              onSelect={onSelect}
              onOpenMaps={onOpenMaps}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {/* ── Mobile bottom sheet ── */}
      <div className="followup-panel-mobile" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 2000, background: 'white',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        direction: 'rtl',
        transform: 'translateY(0)',
        animation: 'slideUpSheet 0.25s ease',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#D1D5DB' }} />
        </div>

        {/* Sheet header */}
        <div style={{
          padding: '8px 16px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #F3F4F6',
        }}>
          <button onClick={onClose} style={{
            background: '#F3F4F6', border: 'none', borderRadius: '7px',
            width: '28px', height: '28px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
          }}><X size={14} /></button>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 900, fontSize: '14px', color: '#111827', margin: 0 }}>{title}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
              عدد المخدومين: {toArabicNumerals(students.length)}
            </p>
          </div>
        </div>

        {/* Mobile scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 20px' }}>
          {students.map(s => (
            <StudentPanelCard
              key={s.id}
              student={s}
              isSelected={s.id === selectedId}
              onSelect={onSelect}
              onOpenMaps={onOpenMaps}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {/* Mobile overlay */}
      <div
        className="followup-panel-mobile"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1999,
          background: 'rgba(0,0,0,0.3)',
        }}
      />
    </>
  );
}

// ─── Inner: popup opener for selected marker ──────────────────────────────────
function MarkerFocuser({ student, markersRef }) {
  const map = useMap();
  useEffect(() => {
    if (!student) return;
    if (!isValidCoordinate(student.latitude, student.longitude)) return;
    const pos = [parseFloat(student.latitude), parseFloat(student.longitude)];
    map.setView(pos, Math.max(map.getZoom(), 16), { animate: true });
    // open popup if marker ref exists
    const marker = markersRef.current[student.id];
    if (marker) {
      setTimeout(() => marker.openPopup(), 350);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);
  return null;
}

// ─── CSS (injected once) ──────────────────────────────────────────────────────
const CSS = `
@keyframes slideUpSheet {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@media (min-width: 769px) {
  .followup-panel-mobile { display: none !important; }
}
@media (max-width: 768px) {
  .followup-panel-desktop { display: none !important; }
}
`;
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FollowUpMapPage() {
  injectCSS();

  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [students,           setStudents]           = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [search,             setSearch]             = useState('');
  const [statusFilter,       setStatusFilter]       = useState('الكل');
  const [gradeFilter,        setGradeFilter]        = useState('الكل');
  const [geoLoading,         setGeoLoading]         = useState(false);
  const [geoMsg,             setGeoMsg]             = useState(null);

  // Panel state
  const [selectedMapStudents, setSelectedMapStudents] = useState([]);
  const [selectedMapTitle,    setSelectedMapTitle]    = useState('');
  const [selectedStudentId,   setSelectedStudentId]   = useState(null);
  const [focusStudent,        setFocusStudent]        = useState(null);

  const mapRef     = useRef(null);
  const markersRef = useRef({}); // id → L.Marker instance
  const geoAsked   = useRef(false);

  const role            = profile?.role;
  const showGradeFilter = role === 'ADMIN' || role === 'SERVICE_HEAD';

  // ── Grade options ─────────────────────────────────────────────────────────
  const gradeOptions = useMemo(() => {
    if (role === 'SERVICE_HEAD') {
      const grades = Array.isArray(profile?.assigned_grades)
        ? profile.assigned_grades
        : profile?.assigned_grade ? [profile.assigned_grade] : [];
      return ['الكل', ...grades];
    }
    if (role === 'ADMIN') return ['الكل', ...GRADES.slice(1).map(g => g.label)];
    return ['الكل'];
  }, [role, profile]);

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudentsForFollowUpMap(profile);
      setStudents(data);
    } catch (err) {
      console.error('[FollowUpMapPage] fetch error:', err);
      setError('تعذر تحميل الخريطة، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  }, [profile]);
  useEffect(() => { load(); }, [load]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    let list = students;
    if (statusFilter !== 'الكل') list = list.filter(s => s.status === statusFilter);
    if (gradeFilter  !== 'الكل') list = list.filter(s => s.grade  === gradeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, statusFilter, gradeFilter, search]);

  const studentsWithLocation = useMemo(
    () => filteredStudents.filter(s => isValidCoordinate(s.latitude, s.longitude)),
    [filteredStudents]
  );
  const studentsWithoutLocation = filteredStudents.filter(
    s => !isValidCoordinate(s.latitude, s.longitude)
  );

  // ── Group students by exact coordinates ──
  const locationGroups = useMemo(() => {
    const map = new Map();
    studentsWithLocation.forEach(s => {
      // Use 6 decimals to group effectively identical coordinates
      const lat = parseFloat(s.latitude).toFixed(6);
      const lng = parseFloat(s.longitude).toFixed(6);
      const key = `${lat},${lng}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          lat: parseFloat(s.latitude),
          lng: parseFloat(s.longitude),
          students: [],
        });
      }
      map.get(key).students.push(s);
    });
    return Array.from(map.values());
  }, [studentsWithLocation]);

  // ── Panel helpers ─────────────────────────────────────────────────────────
  const openStudentsPanel = useCallback((studs) => {
    // Flatten any nested arrays and filter nulls
    const list = Array.isArray(studs) ? studs.flat().filter(Boolean) : [studs].filter(Boolean);

    // Deduplicate by student ID (or code as fallback)
    const unique = Array.from(
      new Map(list.map(s => [s.id || s.code, s])).values()
    );

    console.log('openStudentsPanel count:', unique.length, unique.map(s => s.name));

    setSelectedMapStudents(unique);
    setSelectedMapTitle(unique.length > 1 ? 'مخدومين في هذه المنطقة' : 'بيانات المخدوم');
    setSelectedStudentId(null);
    setFocusStudent(null);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedMapStudents([]);
    setSelectedMapTitle('');
    setSelectedStudentId(null);
    setFocusStudent(null);
  }, []);

  const handleCardSelect = useCallback((student) => {
    setSelectedStudentId(student.id);
    setFocusStudent(student);
  }, []);

  const handleZoomToArea = useCallback(() => {
    if (!mapRef.current || selectedMapStudents.length === 0) return;
    const valid = selectedMapStudents.filter(s => isValidCoordinate(s.latitude, s.longitude));
    if (valid.length === 0) return;
    if (valid.length === 1) {
      mapRef.current.setView(
        [parseFloat(valid[0].latitude), parseFloat(valid[0].longitude)],
        17, { animate: true }
      );
      return;
    }
    const lats = valid.map(s => parseFloat(s.latitude));
    const lngs = valid.map(s => parseFloat(s.longitude));
    mapRef.current.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 17, animate: true }
    );
  }, [selectedMapStudents]);

  // ── Map ready ─────────────────────────────────────────────────────────────
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
    if (studentsWithLocation.length === 0 && !geoAsked.current) {
      askGeolocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsWithLocation.length]);

  // ── Geolocation ───────────────────────────────────────────────────────────
  const askGeolocation = useCallback(async () => {
    if (geoAsked.current || geoLoading) return;
    geoAsked.current = true;
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const { lat, lng } = await requestUserLocation();
      mapRef.current?.setView([lat, lng], 14, { animate: true });
      setGeoMsg({ type: 'ok', text: 'تم فتح الخريطة بالقرب من موقعك الحالي. لن يتم حفظ موقعك.' });
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

  // ── Misc ──────────────────────────────────────────────────────────────────
  const openMaps = (student) => window.open(
    `https://www.google.com/maps/search/?api=1&query=${student.latitude},${student.longitude}`,
    '_blank', 'noopener,noreferrer'
  );

  const initialView = useMemo(
    () => getInitialMapView({ studentsWithLocations: studentsWithLocation }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const panelOpen = selectedMapStudents.length > 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '80vh', direction: 'rtl', fontFamily: 'Cairo, sans-serif', gap: '10px',
    }}>
      <svg style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }}
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span style={{ color: '#6B7280', fontSize: '14px' }}>جاري تحميل الخريطة...</span>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '70vh', gap: '16px',
      direction: 'rtl', fontFamily: 'Cairo, sans-serif',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%',
        background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><AlertTriangle size={24} color="#DC2626" /></div>
      <p style={{ fontSize: '15px', color: '#374151', fontWeight: 700 }}>{error}</p>
      <button onClick={load} style={{
        padding: '10px 24px', borderRadius: '9px',
        background: 'linear-gradient(135deg,#8B1A1A,#B52626)', color: 'white',
        border: 'none', fontFamily: 'Cairo, sans-serif', fontWeight: 700,
        fontSize: '13px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '7px',
      }}>
        <RefreshCw size={14} /> إعادة المحاولة
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>

      {/* Page header */}
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#111827', margin: 0 }}>
          🗺️ خريطة الافتقاد
        </h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0', fontWeight: 500 }}>
          اعرض المخدومين حسب أماكن السكن لتسهيل الافتقاد
        </p>
      </div>

      {/* Controls bar */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '13px 16px',
        border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Search */}
          <div style={{ flex: '1 1 200px', position: 'relative', minWidth: '180px' }}>
            <Search size={14} style={{
              position: 'absolute', right: '11px', top: '50%',
              transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم المخدوم أو الكود..."
              style={{
                width: '100%', padding: '8px 32px 8px 12px',
                border: '1.5px solid #E5E7EB', borderRadius: '9px',
                fontFamily: 'Cairo, sans-serif', fontSize: '12px',
                color: '#374151', direction: 'rtl', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#8B1A1A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Status filters */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: '6px 11px', borderRadius: '8px', fontSize: '11px',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${statusFilter === f ? '#8B1A1A' : '#E5E7EB'}`,
                background: statusFilter === f ? '#8B1A1A' : 'white',
                color: statusFilter === f ? 'white' : '#6B7280',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>

          {/* Grade filter */}
          {showGradeFilter && (
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} style={{
              padding: '7px 11px', border: '1.5px solid #E5E7EB',
              borderRadius: '9px', fontFamily: 'Cairo, sans-serif',
              fontSize: '12px', color: '#374151', direction: 'rtl',
              outline: 'none', cursor: 'pointer', background: 'white', minWidth: '130px',
            }}>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {/* Refresh */}
          <button onClick={load} title="تحديث" style={{
            width: '36px', height: '36px', borderRadius: '9px',
            border: '1.5px solid #E5E7EB', background: 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B7280', transition: 'all 0.15s', flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#8B1A1A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: '14px', marginTop: '10px',
          padding: '8px 12px', background: '#F9FAFB',
          borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16A34A' }} />
            <span style={{ fontSize: '11px', color: '#374151', fontWeight: 600 }}>
              {toArabicNumerals(studentsWithLocation.length)} مخدوم على الخريطة
            </span>
          </div>
          {studentsWithoutLocation.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertTriangle size={12} color="#D97706" />
              <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                {toArabicNumerals(studentsWithoutLocation.length)} بدون موقع
              </span>
            </div>
          )}
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={12} color="#8B1A1A" />
            <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>
              الإجمالي: {toArabicNumerals(filteredStudents.length)}
            </span>
          </div>
        </div>

        {/* Geo message */}
        {geoMsg && (
          <div style={{
            marginTop: '8px', padding: '7px 12px', borderRadius: '8px',
            background: geoMsg.type === 'ok' ? '#F0FDF4' : '#FEF9C3',
            border: `1px solid ${geoMsg.type === 'ok' ? '#BBF7D0' : '#FDE68A'}`,
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            <span style={{ fontSize: '13px' }}>{geoMsg.type === 'ok' ? '📍' : '⚠️'}</span>
            <span style={{
              fontSize: '11px', fontWeight: 600,
              color: geoMsg.type === 'ok' ? '#166534' : '#92400E',
              flex: 1,
            }}>{geoMsg.text}</span>
            <button onClick={() => setGeoMsg(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', fontSize: '16px', lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}
      </div>

      {/* Map + side panel layout */}
      <div style={{
        display: 'flex', gap: '12px',
        height: 'calc(100vh - 285px)', minHeight: '400px',
      }}>

        {/* ── Map container ── */}
        <div style={{
          flex: 1, borderRadius: '14px', overflow: 'hidden',
          border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          position: 'relative',
        }}>

          {/* Empty state overlay */}
          {studentsWithLocation.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '14px',
              background: '#F9FAFB', zIndex: 5,
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><MapIcon size={28} color="#8B1A1A" /></div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#374151', margin: 0 }}>
                  لا توجد مواقع محددة بعد
                </p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px', maxWidth: '260px', lineHeight: 1.6 }}>
                  افتح ملف المخدوم وحدد موقع السكن أولًا
                </p>
              </div>
              <button onClick={() => navigate('/students')} style={{
                padding: '9px 20px', borderRadius: '9px',
                background: 'linear-gradient(135deg,#8B1A1A,#B52626)',
                color: 'white', border: 'none',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}>انتقل إلى المخدومين</button>
            </div>
          )}

          {/* Leaflet map */}
          <MapContainer
            center={initialView.center}
            zoom={initialView.zoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapController
              onReady={handleMapReady}
              studentsWithLocation={studentsWithLocation}
            />
            <MapResizeTrigger trigger={panelOpen} />
            <MarkerFocuser student={focusStudent} markersRef={markersRef} />

            <MarkerClusterGroup
              iconCreateFunction={createClusterCustomIcon}
              showCoverageOnHover={false}
              maxClusterRadius={55}
              // We control zoom ourselves so we can also open the panel atomically
              zoomToBoundsOnClick={false}
              onClick={(e) => {
                const cluster = e.layer;
                const childMarkers = cluster.getAllChildMarkers();

                // ── Extract students from our manually grouped markers ──
                let studs = [];
                childMarkers.forEach(m => {
                  const groupStuds = m.groupStudents || m.options?.groupStudents || m._studentData;
                  if (Array.isArray(groupStuds)) {
                    studs.push(...groupStuds);
                  } else if (m.studentData || m.options?.studentData) {
                    studs.push(m.studentData || m.options?.studentData);
                  }
                });

                // Deduplicate by student ID in case of overlaps
                const uniqueStudents = Array.from(
                  new Map(studs.filter(Boolean).map(s => [s.id, s])).values()
                );

                console.log('[FollowUpMap] Cluster clicked');
                console.log('[FollowUpMap] Cluster child count:', childMarkers.length);
                console.log('[FollowUpMap] Unique students extracted:', uniqueStudents.length);

                console.log('MARKER CLICK DEBUG', {
                  markerType: 'Cluster',
                  markerLabelCount: childMarkers.length,
                  selectedStudentsToSet: uniqueStudents.map(s => `${s.name} - ${s.code}`)
                });

                // ── Open panel immediately with all cluster students ──
                if (uniqueStudents.length > 0) {
                  openStudentsPanel(uniqueStudents);
                }

                // ── Zoom to cluster bounds (we control this since zoomToBoundsOnClick=false) ──
                if (mapRef.current) {
                  try {
                    const bounds = cluster.getBounds();
                    mapRef.current.fitBounds(bounds, {
                      padding: [40, 40],
                      maxZoom: 17,
                      animate: true,
                    });
                  } catch (err) {
                    console.warn('[FollowUpMap] fitBounds error:', err);
                  }
                }
              }}
            >

              {locationGroups.map(group => {
                const isMulti = group.students.length > 1;
                // If this group contains the selected student, highlight it
                const isSelected = selectedStudentId && group.students.some(s => s.id === selectedStudentId);

                const icon = createStudentCountIcon(group.students.length, isSelected);

                return (
                  <Marker
                    key={group.id}
                    position={[group.lat, group.lng]}
                    icon={icon}
                    ref={el => {
                      if (el) {
                        // Attach the entire group array for cluster extraction robustly
                        el._studentData = group.students;
                        el.groupStudents = group.students;
                        if (el.options) {
                          el.options.groupStudents = group.students;
                        }
                        // For focus functionality, map each student ID to this marker
                        group.students.forEach(s => {
                          markersRef.current[s.id] = el;
                        });
                      }
                    }}
                    eventHandlers={{
                      click: () => {
                        console.log('MARKER CLICK DEBUG', {
                          markerType: isMulti ? 'ManualGrouped' : 'Single',
                          groupLength: group.students.length,
                          clickedStudent: isMulti ? 'Multiple' : group.students[0].name,
                        });

                        openStudentsPanel(group.students);

                        if (isMulti) {
                          // Slight zoom/pan to group
                          if (mapRef.current) {
                            mapRef.current.setView([group.lat, group.lng], Math.max(mapRef.current.getZoom(), 17), { animate: true });
                          }
                        } else {
                          setSelectedStudentId(group.students[0].id);
                        }
                      },
                    }}
                  >
                    <Popup maxWidth={230}>
                      <div style={{
                        direction: 'rtl', fontFamily: 'Cairo, sans-serif',
                        padding: '3px 2px', minWidth: '190px',
                      }}>
                        {isMulti ? (
                          <div style={{ textAlign: 'center', padding: '10px 5px' }}>
                            <p style={{ fontWeight: 800, fontSize: '14px', color: '#111827', margin: '0 0 5px' }}>
                              {toArabicNumerals(group.students.length)} مخدومين في هذا المبنى
                            </p>
                            <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>
                              تم فتح القائمة الجانبية لعرض أسمائهم
                            </p>
                          </div>
                        ) : (
                          // Single student popup
                          (() => {
                            const student = group.students[0];
                            return (
                              <>
                                <p style={{ fontWeight: 800, fontSize: '13px', color: '#111827', margin: '0 0 3px' }}>
                                  {student.name}
                                </p>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 7px' }}>
                                  {student.code} · {student.grade}
                                </p>
                                <StatusBadge status={student.status} />
                                <div style={{ marginTop: '7px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {student.parent_phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Phone size={11} color="#8B1A1A" />
                                      <span style={{ fontSize: '10px', color: '#6B7280' }}>المخدوم:</span>
                                      <a href={`tel:${student.parent_phone}`} style={{
                                        fontSize: '11px', color: '#8B1A1A', fontWeight: 700, textDecoration: 'none',
                                      }} dir="ltr">{student.parent_phone}</a>
                                    </div>
                                  )}
                                  {student.parent_phone_2 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Phone size={11} color="#1D4ED8" />
                                      <span style={{ fontSize: '10px', color: '#6B7280' }}>ولي الأمر:</span>
                                      <a href={`tel:${student.parent_phone_2}`} style={{
                                        fontSize: '11px', color: '#1D4ED8', fontWeight: 700, textDecoration: 'none',
                                      }} dir="ltr">{student.parent_phone_2}</a>
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', marginTop: '9px' }}>
                                  <button
                                    onClick={() => navigate(`/students/${student.id}`)}
                                    style={{
                                      flex: 1, padding: '6px', borderRadius: '7px',
                                      background: '#FEF2F2', color: '#8B1A1A',
                                      border: 'none', fontFamily: 'Cairo, sans-serif',
                                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                    }}
                                  >ملف المخدوم</button>
                                  <button
                                    onClick={() => openMaps(student)}
                                    style={{
                                      flex: 1, padding: '6px', borderRadius: '7px',
                                      background: '#F0FDF4', color: '#16A34A',
                                      border: 'none', fontFamily: 'Cairo, sans-serif',
                                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                    }}
                                  ><ExternalLink size={10} />خرائط</button>
                                </div>
                              </>
                            );
                          })()
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>

          {/* Overlay nav buttons */}
          <MapOverlayButtons
            onGoDefault={goToDefault}
            onUseMyLocation={askGeolocation}
            geoLoading={geoLoading}
          />
        </div>

        {/* ── Desktop side panel ── */}
        {panelOpen && (
          <SidePanel
            students={selectedMapStudents}
            title={selectedMapTitle}
            selectedId={selectedStudentId}
            onSelect={handleCardSelect}
            onClose={closePanel}
            onOpenMaps={openMaps}
            onNavigate={s => navigate(`/students/${s.id}`)}
            onZoomToArea={handleZoomToArea}
          />
        )}
      </div>
    </div>
  );
}
