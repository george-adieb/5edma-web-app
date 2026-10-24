import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { fetchServantsForStudentAssignment } from '../lib/database';

const SEARCH_THRESHOLD = 7;

const fieldStyle = (err, disabled) => ({
  width: '100%', padding: '9px 12px', minHeight: '42px', boxSizing: 'border-box',
  border: `1.5px solid ${err ? '#FCA5A5' : '#E5E7EB'}`, borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#374151', direction: 'rtl',
  outline: 'none', background: err ? '#FFF5F5' : 'white',
  opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
});

const note = (color) => ({ fontSize: '11px', color, marginTop: '4px', textAlign: 'right', lineHeight: 1.6 });

/**
 * Responsible-servant dropdown filtered by the student's grade + gender (server-side via
 * assignable_servants). `value` is the servant's full_name (what students.servant stores).
 * `saved` ({ grade, gender, servant }) is the stored assignment when editing: it is kept while the
 * grade/gender are unchanged even if it is no longer eligible (legacy), with a warning.
 */
export default function ResponsibleServantField({ grade, gender, value, onChange, error, saved = null }) {
  const [servants, setServants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [cleared, setCleared] = useState(false);
  const [query, setQuery] = useState('');
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const ready = !!(grade && gender);
  const unchangedFromSaved = !!saved && saved.grade === grade && saved.gender === gender;

  useEffect(() => {
    setQuery('');
    setLoadError('');
    if (!ready) {
      setServants([]);
      if (valueRef.current && !unchangedFromSaved) { onChangeRef.current(''); setCleared(true); }
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchServantsForStudentAssignment({ grade, gender })
      .then(list => {
        if (cancelled) return;
        setServants(list);
        const cur = valueRef.current;
        const eligible = list.some(s => s.full_name === cur);
        if (cur && !eligible && !(unchangedFromSaved && cur === saved.servant)) {
          onChangeRef.current('');
          setCleared(true);
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[ResponsibleServantField] load failed:', err);
        setServants([]);
        setLoadError('تعذّر تحميل قائمة الخدام. حاول مرة أخرى.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, gender]);

  const eligible = servants.some(s => s.full_name === value);
  const legacy = !!value && !loading && !loadError && ready && !eligible;
  const q = query.trim();
  const visible = q ? servants.filter(s => s.full_name.includes(q) || s.full_name === value) : servants;
  const disabled = !ready || loading || (!!loadError) || (servants.length === 0 && !legacy);

  let placeholder = 'اختر الخادم المسؤول';
  if (!ready) placeholder = 'اختر المرحلة الدراسية والنوع أولًا';
  else if (loading) placeholder = 'جارٍ التحميل...';
  else if (loadError) placeholder = 'تعذّر التحميل';
  else if (servants.length === 0) placeholder = 'لا يوجد خدام متاحون لهذه المرحلة والنوع';

  return (
    <div>
      {ready && !loading && servants.length > SEARCH_THRESHOLD && (
        <input
          type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم الخادم" aria-label="بحث عن خادم"
          style={{ ...fieldStyle(false, false), marginBottom: '6px', cursor: 'text' }}
        />
      )}
      <div style={{ position: 'relative' }}>
        <select
          value={value || ''} onChange={e => { setCleared(false); onChange(e.target.value); }}
          disabled={disabled} style={fieldStyle(error, disabled)} aria-label="الخادم المسؤول"
        >
          <option value="">{placeholder}</option>
          {legacy && <option value={value}>{value} (خارج النطاق)</option>}
          {visible.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
        </select>
        {loading && (
          <Loader2 size={14} color="#8B1A1A" style={{ position: 'absolute', left: '10px', top: '50%', marginTop: '-7px', animation: 'spin 1s linear infinite', pointerEvents: 'none' }} />
        )}
      </div>
      {!ready && <p style={note('#9CA3AF')}>اختر المرحلة الدراسية والنوع أولًا</p>}
      {loadError && (
        <p style={{ ...note('#DC2626'), display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
          <AlertCircle size={12} />{loadError}
        </p>
      )}
      {ready && !loading && !loadError && servants.length === 0 && !legacy && (
        <p style={note('#B45309')}>لا يوجد خدام متاحون لهذه المرحلة والنوع</p>
      )}
      {legacy && (
        <p style={note('#B45309')}>
          الخادم الحالي «{value}» غير مخصص لهذه المرحلة والنوع. اختر خادمًا مناسبًا من القائمة قبل تغيير التكليف.
        </p>
      )}
      {cleared && !value && (
        <p style={note('#B45309')}>تم مسح الخادم المختار لأنه لا يطابق المرحلة والنوع الحاليين. اختر خادمًا جديدًا.</p>
      )}
    </div>
  );
}
