import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Send, Sparkles, RefreshCw } from 'lucide-react';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  .ai-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 64px);
    max-width: 900px;
    margin: 0 auto;
    direction: rtl;
    font-family: 'Cairo', sans-serif;
  }
  .ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: #F8F7F5;
    scroll-behavior: smooth;
  }
  .ai-input-area {
    flex-shrink: 0;
    background: white;
    border-top: 1px solid #E5E7EB;
    padding: 12px 16px 16px;
  }
  .ai-composer {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: #F3F4F6;
    border-radius: 14px;
    border: 1.5px solid #E5E7EB;
    padding: 8px 8px 8px 12px;
    transition: border-color 0.2s;
  }
  .ai-composer:focus-within { border-color: #8B1A1A; }
  .ai-textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    color: #1A1A1A;
    resize: none;
    line-height: 1.5;
    direction: rtl;
    min-height: 24px;
    max-height: 110px;
    overflow-y: auto;
    padding-top: 2px;
  }
  .ai-textarea::placeholder { color: #9CA3AF; }
  .ai-send-btn {
    background: linear-gradient(135deg, #8B1A1A, #B52626);
    border: none;
    border-radius: 10px;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 6px rgba(139,26,26,0.25);
  }
  .ai-send-btn:hover:not(:disabled) { background: linear-gradient(135deg, #6B1414, #8B1A1A); transform: scale(1.05); }
  .ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .ai-msg-user {
    display: flex;
    justify-content: flex-start;
    animation: fadeIn 0.22s ease;
  }
  .ai-bubble-user {
    max-width: 70%;
    background: linear-gradient(135deg, #8B1A1A, #B52626);
    color: white;
    border-radius: 18px 18px 4px 18px;
    padding: 10px 15px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    box-shadow: 0 2px 6px rgba(139,26,26,0.2);
    word-break: break-word;
  }
  .ai-msg-assistant {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    animation: fadeIn 0.22s ease;
  }
  .ai-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    flex-shrink: 0;
    background: linear-gradient(135deg, #8B1A1A, #B52626);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(139,26,26,0.25);
    margin-top: 2px;
  }
  .ai-bubble-assistant {
    max-width: calc(100% - 42px);
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 4px 18px 18px 18px;
    padding: 11px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .ai-answer-text {
    font-size: 14px;
    color: #1A1A1A;
    line-height: 1.7;
    white-space: pre-line;
    word-break: break-word;
  }
  .ai-timestamp {
    font-size: 10.5px;
    color: #9CA3AF;
    margin-top: 3px;
    margin-right: 42px;
  }
  .ai-items-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .ai-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 13px;
  }
  .ai-chip {
    background: white;
    color: #8B1A1A;
    border: 1.5px solid rgba(139,26,26,0.25);
    border-radius: 20px;
    padding: 6px 13px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Cairo', sans-serif;
    white-space: nowrap;
  }
  .ai-chip:hover:not(:disabled) { background: #8B1A1A; color: white; border-color: #8B1A1A; transform: translateY(-1px); }
  .ai-chip:disabled { opacity: 0.5; cursor: not-allowed; }
  .ai-typing {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    animation: fadeIn 0.2s ease;
  }
  .ai-typing-dots {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 4px 18px 18px 18px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #8B1A1A; }
  .dot-1 { animation: dotBounce 1.2s ease-in-out 0s infinite; }
  .dot-2 { animation: dotBounce 1.2s ease-in-out 0.2s infinite; }
  .dot-3 { animation: dotBounce 1.2s ease-in-out 0.4s infinite; }
  @keyframes dotBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
    30% { transform: translateY(-5px); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ai-chips-area { animation: slideUp 0.35s ease; margin-right: 42px; }
  .ai-error-bar {
    background: #FEE2E2;
    border: 1px solid rgba(220,38,38,0.2);
    border-radius: 10px;
    padding: 9px 14px;
    color: #DC2626;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
    animation: fadeIn 0.2s ease;
  }
  .ai-header {
    background: white;
    border-bottom: 1px solid #E5E7EB;
    padding: 13px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
  }
  .ai-header-icon {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8B1A1A, #B52626);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(139,26,26,0.25);
    flex-shrink: 0;
  }
  .ai-clear-btn {
    background: #F3F4F6;
    border: none;
    border-radius: 7px;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
    color: #6B7280; flex-shrink: 0;
  }
  .ai-clear-btn:hover { background: #E5E7EB; }
  .ai-hint {
    font-size: 11px;
    color: #9CA3AF;
    text-align: center;
    margin-top: 8px;
    margin-bottom: 0;
  }
  .ai-more-badge {
    font-size: 11px;
    color: #9CA3AF;
    font-style: italic;
    margin-top: 4px;
    padding-right: 4px;
  }
`;

// ─── Chips ────────────────────────────────────────────────────────────────────
const CHIPS = [
  { label: 'أعياد ميلاد الشهر',         q: 'مين عيد ميلاده الشهر ده؟' },
  { label: 'الغياب المتكرر',             q: 'مين غاب آخر اجتماعين؟' },
  { label: 'المحتاجين افتقاد',           q: 'مين محتاج افتقاد؟' },
  { label: 'أعلى نقاط',                 q: 'مين أعلى 10 في النقاط؟' },
  { label: 'ملخص الحضور',               q: 'اديني ملخص الحضور' },
  { label: 'توزيع المخدومين',            q: 'كام مخدوم منتظم ومنقطع وجديد؟' },
];

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'منتظم':        { bg: '#DCFCE7', color: '#16A34A' },
  'منقطع':        { bg: '#FEE2E2', color: '#DC2626' },
  'جديد':         { bg: '#DBEAFE', color: '#1D4ED8' },
  'يحتاج افتقاد': { bg: '#FEF3C7', color: '#B45309' },
};

// ─── Student card (single result) ─────────────────────────────────────────────
function StudentCard({ item, requestedField }) {
  const sc = STATUS_COLORS[item.status] || { bg: '#F3F4F6', color: '#6B7280' };

  if (requestedField === 'details') {
    const sc = STATUS_COLORS[item.status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A' }}>{item.name}</div>
          {item.status && (
            <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
              {item.status}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {item.code       && <span style={{ fontSize: 12, color: '#9CA3AF' }}>كود: {item.code}</span>}
          {item.grade      && <span style={{ fontSize: 12, color: '#6B7280', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>{item.grade}</span>}
          {item.birth_date && <span style={{ fontSize: 12, color: '#6B7280', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>ميلاد: {item.birth_date}</span>}
          {item.total_points !== undefined && (
            <span style={{ fontSize: 12, color: '#C9A84C', fontWeight: 700, borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>🏆 {item.total_points} نقطة</span>
          )}
          {item.last_attendance && (
            <span style={{ fontSize: 12, color: '#4B5563', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>آخر حضور: {item.last_attendance}</span>
          )}
        </div>

        {(item.address || item.nearest_church) && (
          <div style={{ fontSize: 12, color: '#4B5563', borderTop: '1px solid #F3F4F6', paddingTop: 8, marginTop: 8, marginBottom: 8 }}>
            {item.address && <div><strong>العنوان / المنطقة:</strong> {item.address}</div>}
            {item.nearest_church && <div style={{ marginTop: 2 }}><strong>أقرب كنيسة:</strong> {item.nearest_church}</div>}
          </div>
        )}

        {item.recent_logs?.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>آخر 5 عمليات نقاط:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.recent_logs.map((log, li) => (
                <div key={li} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4B5563', padding: '3px 6px', background: '#F9FAFB', borderRadius: 6 }}>
                  <span>{log.date} - {log.reason || log.source || 'نقاط'}</span>
                  <span style={{ color: log.points >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                    {log.points > 0 ? '+' : ''}{log.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (requestedField === 'address') {
    return (
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A', marginBottom: 8 }}>{item.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <strong>العنوان / المنطقة:</strong> {item.address || 'لا يوجد عنوان مسجل لهذا المخدوم.'}
          </div>
          {item.nearest_church && (
            <div style={{ fontSize: 13, color: '#374151' }}>
              <strong>أقرب كنيسة:</strong> {item.nearest_church}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (requestedField === 'birthday') {
    return (
      <div style={{ background: '#FFFBEB', border: '1px solid #C9A84C33', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>🎂</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A' }}>{item.name}</div>
            {item.grade && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.grade}</div>}
          </div>
        </div>
        {item.birth_date && <div style={{ fontSize: 13, color: '#374151' }}><b>تاريخ الميلاد:</b> {item.birth_date}</div>}
        {item.age       && <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}><b>العمر:</b> {item.age}</div>}
      </div>
    );
  }

  if (requestedField === 'points') {
    return (
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A' }}>{item.name}</div>
          <span style={{ background: '#C9A84C', color: 'white', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
            {item.total_points} نقطة
          </span>
        </div>
        {item.grade && <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: item.recent_logs?.length ? 8 : 0 }}>{item.grade}</div>}
        {item.recent_logs?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {item.recent_logs.map((log, li) => (
              <div key={li} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '3px 6px', background: '#F3F4F6', borderRadius: 6 }}>
                <span>{log.reason || log.source || 'نقاط'}</span>
                <span style={{ color: log.points >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                  {log.points > 0 ? '+' : ''}{log.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (requestedField === 'attendance') {
    const statusColor = { 'حاضر': '#16A34A', 'غائب': '#DC2626', 'معتذر': '#D97706' };
    return (
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A', marginBottom: 8 }}>{item.name}</div>
        {item.date ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'white', border: '1px solid #F3F4F6', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: '#374151' }}>{item.date}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[item.status] || '#6B7280' }}>{item.status}</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>لا يوجد سجلات حضور.</div>
        )}
      </div>
    );
  }

  // General / default
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A' }}>{item.name}</div>
        {item.status && (
          <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
            {item.status}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {item.code       && <span style={{ fontSize: 12, color: '#9CA3AF' }}>كود: {item.code}</span>}
        {item.grade      && <span style={{ fontSize: 12, color: '#6B7280', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>{item.grade}</span>}
        {item.birth_date && <span style={{ fontSize: 12, color: '#6B7280', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>ميلاد: {item.birth_date}</span>}
        {item.total_points > 0 && (
          <span style={{ fontSize: 12, color: '#C9A84C', fontWeight: 700, borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>🏆 {item.total_points} نقطة</span>
        )}
        {item.last_attendance && (
          <span style={{ fontSize: 12, color: '#4B5563', borderRight: '1px solid #E5E7EB', paddingRight: 8 }}>آخر حضور: {item.last_attendance}</span>
        )}
      </div>

      {(item.address || item.nearest_church) && (
        <div style={{ fontSize: 12, color: '#4B5563', borderTop: '1px solid #F3F4F6', paddingTop: 8, marginTop: 8 }}>
          {item.address && <div><strong>العنوان / المنطقة:</strong> {item.address}</div>}
          {item.nearest_church && <div style={{ marginTop: 2 }}><strong>أقرب كنيسة:</strong> {item.nearest_church}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Item list renderer ───────────────────────────────────────────────────────
function renderItems(items, intent, requestedField) {
  if (!items || items.length === 0) return null;
  const MAX     = 10;
  const visible = items.slice(0, MAX);
  const extra   = items.length - MAX;

  // Single student → rich card
  if ((intent === 'student_lookup' || intent === 'student_lookup_by_code') && items.length === 1) {
    return (
      <div className="ai-items-grid">
        <StudentCard item={visible[0]} requestedField={requestedField} />
      </div>
    );
  }

  const rows = visible.map((item, i) => {
    // Birthdays
    if (intent === 'birthdays_this_month' || intent === 'birthdays_this_week') {
      return (
        <div key={i} className="ai-item-row" style={{ background: '#FFFBEB', border: '1px solid #C9A84C22' }}>
          <span style={{ fontSize: 16 }}>🎂</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
            {item.grade && <span style={{ color: '#6B7280', marginRight: 6 }}>{item.grade}</span>}
          </div>
          {item.birth_date && <span style={{ color: '#9CA3AF', fontSize: 12 }}>{item.birth_date}</span>}
        </div>
      );
    }

    // Leaderboard
    if (intent === 'points_leaderboard') {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return (
        <div key={i} className="ai-item-row" style={{ background: '#FFFBEB', border: '1px solid #C9A84C22', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, minWidth: 24, textAlign: 'center' }}>{medal}</span>
            <div>
              <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
              {item.grade && <span style={{ color: '#9CA3AF', fontSize: 11, marginRight: 5 }}>{item.grade}</span>}
            </div>
          </div>
          <span style={{ background: '#C9A84C', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {item.total_points} نقطة
          </span>
        </div>
      );
    }

    // Repeated absence
    if (intent === 'repeated_absence') {
      return (
        <div key={i} className="ai-item-row" style={{ background: '#FFF1F2', border: '1px solid #DC262622', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>❌</span>
            <div>
              <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
              {item.grade && <span style={{ color: '#9CA3AF', fontSize: 11, marginRight: 5 }}>{item.grade}</span>}
            </div>
          </div>
          {item.absent_sessions && (
            <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
              غاب {item.absent_sessions}×
            </span>
          )}
        </div>
      );
    }

    // Needs followup
    if (intent === 'needs_followup') {
      return (
        <div key={i} className="ai-item-row" style={{ background: '#F5EAEA', border: '1px solid #8B1A1A22', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>❤️</span>
            <div>
              <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
              {item.grade && <span style={{ color: '#9CA3AF', fontSize: 11, marginRight: 5 }}>{item.grade}</span>}
            </div>
          </div>
          {item.status && (
            <span style={{ background: '#8B1A1A', color: 'white', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
              {item.status}
            </span>
          )}
        </div>
      );
    }

    // Status summary
    if (intent === 'student_status_summary') {
      const colorsMap = {
        'منتظم':        { bg: '#DCFCE7', color: '#16A34A', icon: '✅' },
        'منقطع':        { bg: '#FEE2E2', color: '#DC2626', icon: '❌' },
        'جديد':         { bg: '#DBEAFE', color: '#1D4ED8', icon: '🆕' },
        'يحتاج افتقاد': { bg: '#FEF3C7', color: '#B45309', icon: '⚠️' },
      };
      const c = colorsMap[item.label] || { bg: '#F3F4F6', color: '#6B7280', icon: '•' };
      return (
        <div key={i} className="ai-item-row" style={{ background: c.bg, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>{c.icon}</span>
            <span style={{ fontWeight: 700, color: c.color, fontSize: 14 }}>{item.label}</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.color }}>{item.count}</span>
        </div>
      );
    }

    // Attendance summary grid
    if (intent === 'attendance_summary') {
      return (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          background: '#F0FDF4', border: '1px solid #16A34A22',
          borderRadius: 10, padding: '10px 12px',
        }}>
          {[
            { label: 'حاضر',  val: item.present,       color: '#16A34A' },
            { label: 'غائب',  val: item.absent,        color: '#DC2626' },
            { label: 'معتذر', val: item.excused,       color: '#D97706' },
            { label: 'النسبة',val: `${item.rate}%`,    color: '#8B1A1A' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 20, color }}>{val}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{label}</div>
            </div>
          ))}
        </div>
      );
    }

    // Student lookup — disambiguation list (multiple matches)
    if (intent === 'student_lookup') {
      return (
        <div key={i} className="ai-item-row" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 14 }}>{item.name}</span>
            {item.grade && <span style={{ color: '#9CA3AF', fontSize: 12, marginRight: 6 }}>{item.grade}</span>}
          </div>
          {item.code && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{item.code}</span>}
        </div>
      );
    }

    // Default row
    return (
      <div key={i} className="ai-item-row" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <span style={{ fontSize: 14, color: '#6B7280' }}>•</span>
        <div>
          <span style={{ fontWeight: 600, color: '#1A1A1A', fontSize: 13 }}>{item.name || item.status}</span>
          {item.grade && <span style={{ color: '#9CA3AF', fontSize: 12, marginRight: 6 }}>{item.grade}</span>}
        </div>
      </div>
    );
  });

  return (
    <div className="ai-items-grid">
      {rows}
      {extra > 0 && <p className="ai-more-badge">تم عرض أول 10 نتائج من أصل {items.length}</p>}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function UserMessage({ content }) {
  return (
    <div className="ai-msg-user">
      <div className="ai-bubble-user">{content}</div>
    </div>
  );
}

function AssistantMessage({ msg }) {
  return (
    <>
      <div className="ai-msg-assistant">
        <div className="ai-avatar">
          <Bot size={16} color="white" />
        </div>
        <div className="ai-bubble-assistant">
          <div className="ai-answer-text">{msg.content}</div>
          {renderItems(msg.items, msg.intent, msg.requested_field)}
        </div>
      </div>
      <div className="ai-timestamp">الخادم المساعد · {msg.time}</div>
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="ai-typing">
      <div className="ai-avatar" style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A1A, #B52626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Bot size={16} color="white" />
      </div>
      <div className="ai-typing-dots">
        <div style={{ display: 'flex', gap: 4 }}>
          <div className="dot dot-1" />
          <div className="dot dot-2" />
          <div className="dot dot-3" />
        </div>
        <span style={{ fontSize: 13, color: '#6B7280' }}>الخادم المساعد بيفكر...</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { profile } = useAuth();
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [chipsShown, setChipsShown] = useState(true);
  const [lastStudentContext, setLastStudentContext] = useState(null);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  function formatTime(d) {
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  // Intro message
  useEffect(() => {
    setMessages([{
      id: 'intro',
      role: 'assistant',
      content: 'أنا الخادم المساعد 🙏\nأقدر أساعدك تعرف معلومات عن الحضور، الافتقاد، أعياد الميلاد، والنقاط — داخل نطاق خدمتك.\nكمان تقدر تسألني عن أي مخدوم بالاسم.',
      time: formatTime(new Date()),
      items: [],
      intent: null,
      requested_field: null,
    }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    setInput('');
    setError('');
    setChipsShown(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      time: formatTime(new Date()),
    }]);
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
        body: { question: q, lastStudentContext },
      });

      if (fnError) throw new Error(fnError.message);

      setMessages(prev => [...prev, {
        id:              `a-${Date.now()}`,
        role:            'assistant',
        content:         data?.answer || 'لم أتمكن من الإجابة، حاول مرة أخرى.',
        intent:          data?.intent,
        requested_field: data?.requested_field,
        count:           data?.count,
        items:           data?.items || [],
        time:            formatTime(new Date()),
      }]);

      if ((data?.intent === 'student_lookup' || data?.intent === 'student_lookup_by_code') && data?.items?.length === 1) {
        const student = data.items[0];
        setLastStudentContext({
          id: student.id,
          name: student.name,
          code: student.code || null,
          grade: student.grade || null
        });
      }
    } catch (err) {
      console.error('[AIAssistantPage]', err);
      setError('حدث خطأ أثناء معالجة السؤال، حاول مرة أخرى');
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [input, loading, lastStudentContext]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e) {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
  }

  function clearChat() {
    setMessages([{
      id: `intro-${Date.now()}`,
      role: 'assistant',
      content: 'أنا الخادم المساعد 🙏\nأقدر أساعدك تعرف معلومات عن الحضور، الافتقاد، أعياد الميلاد، والنقاط — داخل نطاق خدمتك.\nكمان تقدر تسألني عن أي مخدوم بالاسم.',
      time: formatTime(new Date()),
      items: [],
      intent: null,
      requested_field: null,
    }]);
    setChipsShown(true);
    setError('');
    setInput('');
    setLastStudentContext(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  const roleBadge = profile?.role === 'ADMIN'
    ? { label: 'مدير',      bg: '#F5EAEA', color: '#8B1A1A' }
    : profile?.role === 'SERVICE_HEAD'
    ? { label: 'رأس خدمة', bg: '#FEF3C7', color: '#B45309' }
    : { label: 'خادم',     bg: '#DBEAFE', color: '#1D4ED8' };

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="ai-page">

        {/* Header */}
        <div className="ai-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="ai-header-icon">
              <Sparkles size={19} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>
                الخادم المساعد
              </h1>
              <p style={{ fontSize: 11.5, color: '#6B7280', margin: '2px 0 0', lineHeight: 1.4 }}>
                اسأل عن الحضور، الافتقاد، أعياد الميلاد، النقاط، أو اسم مخدوم
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: roleBadge.bg, color: roleBadge.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
              {roleBadge.label}
            </span>
            <button className="ai-clear-btn" onClick={clearChat} title="محادثة جديدة">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map(msg =>
            msg.role === 'user'
              ? <UserMessage key={msg.id} content={msg.content} />
              : <AssistantMessage key={msg.id} msg={msg} />
          )}

          {/* Suggestion chips */}
          {chipsShown && messages.length === 1 && (
            <div>
              <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8, marginRight: 42, fontWeight: 600 }}>
                جرب إحدى هذه الأسئلة:
              </p>
              <div className="ai-chips-area" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CHIPS.map(chip => (
                  <button
                    key={chip.label}
                    className="ai-chip"
                    disabled={loading}
                    onClick={() => sendMessage(chip.q)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <TypingIndicator />}

          {error && (
            <div className="ai-error-bar">
              <span>⚠️</span> {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="ai-input-area">
          <div className="ai-composer">
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder="اسأل الخادم المساعد... أو اكتب اسم مخدوم"
              disabled={loading}
              rows={1}
              dir="rtl"
            />
            <button
              className="ai-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="إرسال"
            >
              <Send size={15} color="white" style={{ transform: 'scaleX(-1)' }} />
            </button>
          </div>
          <p className="ai-hint">الخادم المساعد يجيب فقط على البيانات داخل نطاق خدمتك</p>
        </div>

      </div>
    </>
  );
}
