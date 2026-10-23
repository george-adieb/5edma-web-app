import { useState, useCallback } from 'react';
import { X, Search, CheckCircle, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';

// ─── Arabic Name Normalisation ────────────────────────────────────────────────
export function normalizeArabicName(name = '') {
  return name
    .toString()
    .trim()
    // Unify alef forms (أ إ آ ٱ → ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Unify ya forms (ى ئ → ي)
    .replace(/[ىئ]/g, 'ي')
    // Unify waw-hamza (ؤ → و)
    .replace(/ؤ/g, 'و')
    // Unify ta marbuta (ة → ه) — for matching only, display is unchanged
    .replace(/ة/g, 'ه')
    // Remove tatweel  ـ
    .replace(/ـ/g, '')
    // Remove tashkeel / diacritics (U+064B – U+065F, U+0670)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Replace any non-Arabic, non-latin, non-digit character with a space
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Similarity Calculation (token-based Jaccard + character bigrams) ─────────
export function calculateNameSimilarity(inputName, studentName) {
  const a = normalizeArabicName(inputName);
  const b = normalizeArabicName(studentName);

  if (!a || !b) return 0;
  if (a === b) return 1;

  // Token-level Jaccard
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  const intersection = [...aTokens].filter(t => bTokens.has(t)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Character-level bigram similarity
  function bigrams(str) {
    const bg = new Set();
    for (let i = 0; i < str.length - 1; i++) bg.add(str.slice(i, i + 2));
    return bg;
  }
  const aBg = bigrams(a);
  const bBg = bigrams(b);
  const bgIntersect = [...aBg].filter(t => bBg.has(t)).length;
  const bgUnion = new Set([...aBg, ...bBg]).size;
  const bigramScore = bgUnion > 0 ? bgIntersect / bgUnion : 0;

  return (jaccard * 0.55) + (bigramScore * 0.45);
}

// ─── Find best student matches for a given input name ────────────────────────
// Priority:
//   1. Exact normalized match     → score 1.0
//   2. Unique partial/contains    → score 0.92
//   3. Fuzzy similarity           → score as calculated
export function findBestStudentMatches(inputName, students) {
  const normInput = normalizeArabicName(inputName);

  const scored = students.map(s => {
    const normStudent = normalizeArabicName(s.name);

    // Priority 1: exact normalized match
    if (normInput === normStudent) {
      return { student: s, score: 1.0 };
    }
    // Priority 2: one fully contains the other (handles partial first-name input)
    if (
      normInput.length >= 3 &&
      (normStudent.includes(normInput) || normInput.includes(normStudent))
    ) {
      return { student: s, score: 0.92 };
    }
    // Priority 3: fuzzy
    return { student: s, score: calculateNameSimilarity(inputName, s.name) };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).filter(r => r.score >= 0.45);
}

// ─── Match Type constants ────────────────────────────────────────────────────
const MATCH_AUTO   = 'auto';      // Green – high confidence
const MATCH_AMBIG  = 'ambiguous'; // Yellow – needs confirmation
const MATCH_NONE   = 'not_found'; // Red – no match

// ─── Main Modal Component ─────────────────────────────────────────────────────
export default function BulkAttendanceModal({ isOpen, onClose, students, onConfirm, selectedDate }) {
  const [step, setStep]             = useState('input');    // 'input' | 'review'
  const [rawText, setRawText]       = useState('');
  const [results, setResults]       = useState([]);
  const [selections, setSelections] = useState({});        // inputName => studentId
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Step 1: Parse & match names ──────────────────────────────────────────
  const handleReview = useCallback(() => {
    const inputNames = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (inputNames.length === 0) return;

    // Build initial results
    const matched = inputNames.map(inputName => {
      const topMatches = findBestStudentMatches(inputName, students);
      if (topMatches.length === 0) {
        return { inputName, type: MATCH_NONE, matches: [], selectedId: null };
      }
      const best = topMatches[0];
      if (best.score >= 0.88 && (topMatches.length === 1 || topMatches[1].score < best.score - 0.15)) {
        return { inputName, type: MATCH_AUTO, matches: topMatches, selectedId: best.student.id };
      }
      if (best.score >= 0.55) {
        return { inputName, type: MATCH_AMBIG, matches: topMatches, selectedId: best.student.id };
      }
      return { inputName, type: MATCH_NONE, matches: topMatches, selectedId: null };
    });

    // Detect duplicate mappings (two input lines mapped to same student)
    const idCount = {};
    matched.forEach(r => {
      if (r.selectedId) idCount[r.selectedId] = (idCount[r.selectedId] || 0) + 1;
    });
    const finalResults = matched.map(r => ({
      ...r,
      duplicate: r.selectedId && idCount[r.selectedId] > 1,
    }));

    const initSelections = {};
    finalResults.forEach(r => { if (r.selectedId) initSelections[r.inputName] = r.selectedId; });

    setResults(finalResults);
    setSelections(initSelections);
    setStep('review');
  }, [rawText, students]);

  // ── Step 2: Handle selection change for ambiguous rows ───────────────────
  const handleSelect = (inputName, studentId) => {
    setSelections(prev => ({ ...prev, [inputName]: studentId || null }));
  };

  // ── Computed summary ─────────────────────────────────────────────────────
  const autoRows   = results.filter(r => r.type === MATCH_AUTO);
  const ambigRows  = results.filter(r => r.type === MATCH_AMBIG);
  const noneRows   = results.filter(r => r.type === MATCH_NONE);

  // Which student IDs will be marked present
  const presentIds = new Set(
    results
      .filter(r => r.type !== MATCH_NONE)
      .map(r => selections[r.inputName])
      .filter(Boolean)
  );

  // Unresolved duplicates: two rows map to the same student
  const allSelectedIds = Object.values(selections).filter(Boolean);
  const dupSet = new Set(allSelectedIds.filter((id, _, arr) => arr.indexOf(id) !== arr.lastIndexOf(id)));

  const hasUnresolvedAmbig = ambigRows.some(r => !selections[r.inputName]);
  const hasDuplicates = dupSet.size > 0;
  const canConfirm = !hasUnresolvedAmbig && !hasDuplicates;

  // ── Step 2: Confirm ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // Build full attendance map for ALL filtered students
      const newAttendance = {};
      students.forEach(s => {
        newAttendance[s.id] = presentIds.has(s.id) ? 'حاضر' : 'غائب';
      });
      await onConfirm(newAttendance);
      showToast('تم تسجيل الحضور من القائمة بنجاح ✓');
      setTimeout(() => {
        onClose();
        setStep('input');
        setRawText('');
        setResults([]);
        setSelections({});
      }, 1500);
    } catch {
      showToast('حدث خطأ أثناء الحفظ، حاول مرة أخرى', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    onClose();
    setStep('input');
    setRawText('');
    setResults([]);
    setSelections({});
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      direction: 'rtl',
    }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      />

      {/* Modal dialog – centered, aware of nothing outside itself */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'white', borderRadius: '16px',
        width: '100%', maxWidth: '620px',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        animation: 'modalIn 0.25s ease',
        fontFamily: 'Cairo, sans-serif',
      }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: '10px', zIndex: 10,
            background: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7',
            color: toast.type === 'error' ? '#991B1B' : '#166534',
            fontWeight: 700, fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 900, color: '#111827', margin: 0 }}>
              إدخال الحضور من قائمة أسماء
            </h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0', fontWeight: 600 }}>
              {selectedDate} · {students.length} مخدوم في النطاق الحالي
            </p>
          </div>
          <button onClick={handleClose} style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            background: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B7280',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body – scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── STEP 1: Input ── */}
          {step === 'input' && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
                الصق أسماء الحاضرين هنا
              </label>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '10px', fontWeight: 600 }}>
                اكتب كل اسم في سطر منفصل
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={'أنطوني أشرف\nأندريا أنطونيوس\nإبرام ميلاد'}
                rows={10}
                style={{
                  width: '100%', borderRadius: '10px', border: '1.5px solid #E5E7EB',
                  padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: '15px',
                  resize: 'vertical', lineHeight: 1.8, outline: 'none', boxSizing: 'border-box',
                  direction: 'rtl', color: '#111827',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#8B1A1A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px', fontWeight: 600 }}>
                {rawText.split('\n').filter(l => l.trim()).length} اسم مُدخل
              </p>
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {step === 'review' && (
            <div>
              {/* Summary pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <SummaryPill icon="✅" label="تم التعرف عليهم" count={autoRows.length} color="#16A34A" bg="#F0FDF4" />
                <SummaryPill icon="⚠️" label="يحتاج تأكيد" count={ambigRows.length} color="#D97706" bg="#FFFBEB" />
                <SummaryPill icon="❌" label="غير موجودين" count={noneRows.length} color="#DC2626" bg="#FEF2F2" />
                <SummaryPill icon="👥" label="سيتم تسجيلهم حاضر" count={presentIds.size} color="#1D4ED8" bg="#EFF6FF" />
              </div>

              {hasDuplicates && (
                <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '13px', color: '#92400E', fontWeight: 700, margin: 0 }}>
                    تحذير: هناك اسمان أو أكثر يشيران لنفس المخدوم. يرجى مراجعة الاختيارات أدناه.
                  </p>
                </div>
              )}

              {noneRows.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '13px', color: '#991B1B', fontWeight: 700, margin: 0 }}>
                    هناك {noneRows.length} {noneRows.length === 1 ? 'اسم' : 'أسماء'} غير موجودة ولن يتم تسجيلها.
                  </p>
                </div>
              )}

              {/* Auto matched */}
              {autoRows.length > 0 && (
                <Section title="تم التعرف عليهم" color="#16A34A" bg="#F0FDF4" icon="✅">
                  {autoRows.map(r => (
                    <ResultRow key={r.inputName} r={r} isDuplicate={dupSet.has(selections[r.inputName])} color="#16A34A" bg="#F0FDF4" />
                  ))}
                </Section>
              )}

              {/* Ambiguous */}
              {ambigRows.length > 0 && (
                <Section title="يحتاج تأكيد" color="#D97706" bg="#FFFBEB" icon="⚠️">
                  {ambigRows.map(r => (
                    <AmbigRow
                      key={r.inputName}
                      r={r}
                      selectedId={selections[r.inputName]}
                      onSelect={id => handleSelect(r.inputName, id)}
                      isDuplicate={dupSet.has(selections[r.inputName])}
                      students={students}
                    />
                  ))}
                </Section>
              )}

              {/* Not found */}
              {noneRows.length > 0 && (
                <Section title="غير موجودين" color="#DC2626" bg="#FEF2F2" icon="❌">
                  {noneRows.map(r => (
                    <ResultRow key={r.inputName} r={r} color="#DC2626" bg="#FEF2F2" notFound />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: '10px', justifyContent: 'flex-start',
          flexShrink: 0, flexDirection: 'row-reverse',
        }}>
          {step === 'input' && (
            <>
              <button
                onClick={handleReview}
                disabled={!rawText.trim()}
                style={primaryBtn(!rawText.trim())}
              >
                <Search size={15} /> مراجعة الأسماء
              </button>
              <button onClick={handleClose} style={ghostBtn()}>إلغاء</button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || confirming}
                style={primaryBtn(!canConfirm || confirming)}
                title={!canConfirm ? 'يرجى حل التكرارات أو تأكيد الاختيارات الغامضة أولاً' : ''}
              >
                <CheckCircle size={15} />
                {confirming ? 'جاري الحفظ...' : `تأكيد وتسجيل الحضور (${presentIds.size} حاضر)`}
              </button>
              <button onClick={() => setStep('input')} style={ghostBtn()}>تعديل القائمة</button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn { from { transform: scale(0.95) translateY(-10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryPill({ icon, label, count, color, bg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: bg, border: `1px solid ${color}22` }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 800, color }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: 900, color, marginRight: '2px' }}>{count}</span>
    </div>
  );
}

function Section({ title, color, bg, icon, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span>{icon}</span>
        <h3 style={{ fontSize: '13px', fontWeight: 800, color, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ borderRadius: '10px', border: `1px solid ${color}33`, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ResultRow({ r, color, bg, notFound, isDuplicate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: isDuplicate ? '#FEF3C7' : bg,
      borderBottom: '1px solid #F3F4F680',
      direction: 'rtl',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
        {r.inputName}
      </span>
      {notFound ? (
        <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 700 }}>غير موجود</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isDuplicate && <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>⚠ مكرر</span>}
          <span style={{ fontSize: '13px', color, fontWeight: 700 }}>
            → {r.matches[0]?.student?.name}
          </span>
        </div>
      )}
    </div>
  );
}

function AmbigRow({ r, selectedId, onSelect, isDuplicate, students }) {
  const selectedStudent = students.find(s => String(s.id) === String(selectedId));
  return (
    <div style={{
      padding: '10px 14px',
      background: isDuplicate ? '#FEF3C7' : '#FFFBEB',
      borderBottom: '1px solid #FDE68A55',
      direction: 'rtl',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{r.inputName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isDuplicate && <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>⚠ مكرر</span>}
          <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>يحتاج تأكيد</span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <select
          value={selectedId || ''}
          onChange={e => onSelect(e.target.value || null)}
          style={{
            width: '100%', padding: '8px 32px 8px 12px', borderRadius: '8px',
            border: `1.5px solid ${isDuplicate ? '#FDE68A' : '#FCD34D'}`,
            fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
            color: '#374151', background: 'white', cursor: 'pointer',
            appearance: 'none', outline: 'none', boxSizing: 'border-box',
          }}
        >
          <option value="">— اختر المخدوم الصحيح —</option>
          {r.matches.map(m => (
            <option key={m.student.id} value={m.student.id}>
              {m.student.name} ({m.student.grade}) — {Math.round(m.score * 100)}%
            </option>
          ))}
          <option value="">لا يوجد تطابق (تجاهل)</option>
        </select>
        <ChevronDown size={14} style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          color: '#9CA3AF', pointerEvents: 'none',
        }} />
      </div>
      {selectedStudent && (
        <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', fontWeight: 600 }}>
          ✓ سيتم تسجيل: {selectedStudent.name} — {selectedStudent.grade}
        </p>
      )}
    </div>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────
function primaryBtn(disabled) {
  return {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', borderRadius: '9px', border: 'none',
    background: disabled ? '#D1D5DB' : 'linear-gradient(135deg, #8B1A1A, #B52626)',
    color: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
  };
}

function ghostBtn() {
  return {
    padding: '10px 18px', borderRadius: '9px',
    border: '1.5px solid #E5E7EB', background: 'white',
    color: '#6B7280', fontFamily: 'Cairo, sans-serif',
    fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
