import { AlertCircle } from 'lucide-react';
import { INTERRUPTED_WITH_REASON } from '../lib/followUpEligibility';

export const STATUS_OPTIONS = [
  { value: 'منتظم',                  label: 'مخدوم منتظم',              sub: 'يحضر بانتظام', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  { value: 'جديد',                    label: 'مخدوم جديد (يحتاج زيارة)', sub: 'أول مرة', color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'يحتاج افتقاد',           label: 'منقطع (يحتاج افتقاد)',    sub: 'غائب فترة', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  { value: INTERRUPTED_WITH_REASON,  label: 'منقطع بسبب',              sub: 'سبب الانقطاع معروف — لا يحتاج افتقاد حاليًا', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

export const REASON_REQUIRED_MSG = 'من فضلك اكتب سبب الانقطاع';

/** Returns an Arabic error message when the status/reason combination is invalid, else ''. */
export const validateStatusReason = (status, reason) =>
  status === INTERRUPTED_WITH_REASON && !String(reason || '').trim() ? REASON_REQUIRED_MSG : '';

/** Status radio cards + the conditional "سبب الانقطاع" textarea. Shared by Add / Edit student. */
export default function StudentStatusField({ status, reason, onStatusChange, onReasonChange, error }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
        {STATUS_OPTIONS.map(opt => {
          const on = status === opt.value;
          return (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${on ? opt.border : '#F3F4F6'}`, background: on ? opt.bg : 'white', transition: 'all 0.15s',
            }}>
              <div style={{ textAlign: 'right', flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: on ? opt.color : '#374151' }}>{opt.label}</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{opt.sub}</p>
              </div>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${on ? opt.color : '#D1D5DB'}`, background: on ? opt.color : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
                {on && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
              </div>
              <input type="radio" name="status" value={opt.value} checked={on}
                onChange={() => onStatusChange(opt.value)} style={{ display: 'none' }} />
            </label>
          );
        })}
      </div>

      {status === INTERRUPTED_WITH_REASON && (
        <div data-has-error={!!error} style={{ marginTop: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px', textAlign: 'right' }}>
            <span style={{ color: '#DC2626' }}>* </span>سبب الانقطاع
          </label>
          <textarea
            value={reason} onChange={e => onReasonChange(e.target.value)} rows={3} maxLength={1000}
            placeholder="اكتب سبب انقطاع المخدوم..."
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
              direction: 'rtl', boxSizing: 'border-box', resize: 'vertical', outline: 'none', lineHeight: 1.6,
              border: `1.5px solid ${error ? '#FCA5A5' : '#E5E7EB'}`, background: error ? '#FFF5F5' : 'white',
            }}
          />
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', textAlign: 'right' }}>
            أمثلة: مسافر لفترة طويلة · ظروف أسرية · انتقل إلى منطقة أخرى · ظروف صحية
          </p>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <p style={{ fontSize: '11px', color: '#DC2626', margin: 0 }}>{error}</p><AlertCircle size={11} color="#DC2626" />
            </div>
          )}
        </div>
      )}
    </>
  );
}
