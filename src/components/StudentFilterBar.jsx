import React, { useState, useMemo } from 'react';
import { STAGE_YEAR_CONFIG } from '../data/mockData';
import { REVERSE_GRADE_MAP } from '../data/constants';

/**
 * Headless Hook for generic filtering logic
 */
export function useStudentFilters(students) {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [year, setYear] = useState('all');

  const stageConfig = STAGE_YEAR_CONFIG.find(s => s.id === stage) ?? null;
  const stageGradeIds = stageConfig ? stageConfig.years.map(y => y.id) : [];

  const baseFiltered = useMemo(() => {
    return students.filter(s => {
      // 1. Search (Name or Code)
      if (search) {
        const q = search.toLowerCase();
        const sName = (s.name || '').toLowerCase();
        const sCode = (s.code || '').toLowerCase();
        if (!sName.includes(q) && !sCode.includes(q)) return false;
      }
      
      // 2. Stage & Year
      if (stage !== 'all') {
        const rawGrade = s.grade_id || s.gradeId || REVERSE_GRADE_MAP[s.grade] || s.grade || '';
        
        if (year !== 'all') {
          if (rawGrade !== year) return false;
        } else {
          // Stage only: match any grade belonging to that stage
          const matchGrade = stageGradeIds.includes(rawGrade);
          // For stages with no years (خريجين)
          const matchStageText = (stageConfig?.years.length === 0 && (s.stage === stage || s.grade === stage));
          
          if (!matchGrade && !matchStageText) return false;
        }
      }
      return true;
    });
  }, [students, search, stage, year, stageConfig, stageGradeIds]);

  return {
    search, setSearch,
    stage, setStage,
    year, setYear,
    stageConfig,
    baseFiltered,
    clearFilters: () => {
      setSearch('');
      setStage('all');
      setYear('all');
    }
  };
}

/**
 * Filter Bar UI Component (Shared between Students & Attendance)
 */
export default function StudentFilterBar({
  search, setSearch,
  stage, setStage,
  year, setYear,
  stageConfig,
  totalCount,
  filteredCount,
  onResetPage,
  hasActiveFilters,
  onClearFilters,
  children
}) {
  const dropdownStyle = {
    padding: '7px 12px 7px 28px',
    borderRadius: '8px', border: '1.5px solid #E5E7EB',
    background: 'white', fontFamily: 'Cairo, sans-serif',
    fontSize: '12.5px', fontWeight: 600, color: '#374151',
    cursor: 'pointer', outline: 'none', direction: 'rtl',
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'left 8px center',
    minWidth: '110px', transition: 'border-color 0.15s',
  };

  const showYearDropdown = stageConfig !== null && stageConfig.years.length > 0;

  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '14px 16px',
      marginBottom: '14px', border: '1px solid #F3F4F6',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Top row: search & count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>من {totalCount} طالب</span>
          <span style={{ fontSize: '28px', fontWeight: 900, color: '#111827' }}>{filteredCount}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#9CA3AF' }}>إجمالي الطلاب</span>
        </div>
        <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
          <svg style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            placeholder="ابحث بالاسم أو الكود..."
            value={search}
            onChange={e => { setSearch(e.target.value); if(onResetPage) onResetPage(); }}
            style={{
              width: '100%', padding: '8px 34px 8px 12px', background: '#F9FAFB', border: '1.5px solid #F3F4F6',
              borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#374151',
              direction: 'rtl', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Filter dropdowns row */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        
        {/* Stage dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>المرحلة</span>
          <div style={{ position: 'relative' }}>
            <select
              value={stage}
              onChange={e => { setStage(e.target.value); setYear('all'); if(onResetPage) onResetPage(); }}
              style={dropdownStyle} onFocus={e => e.target.style.borderColor = '#8B1A1A'} onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            >
              <option value="all">الكل</option>
              {STAGE_YEAR_CONFIG.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Year dropdown */}
        {showYearDropdown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>السنة</span>
            <div style={{ position: 'relative' }}>
              <select
                value={year}
                onChange={e => { setYear(e.target.value); if(onResetPage) onResetPage(); }}
                style={dropdownStyle} onFocus={e => e.target.style.borderColor = '#8B1A1A'} onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              >
                <option value="all">الكل</option>
                {stageConfig.years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Custom filters / extra children */}
        {children && (
          <>
            <div style={{ width: '1px', height: '24px', background: '#E5E7EB', margin: '0 2px' }} />
            {children}
          </>
        )}

        {/* Clear block */}
        {hasActiveFilters && (
          <button
            onClick={() => { onClearFilters(); if(onResetPage) onResetPage(); }}
            style={{
              marginRight: 'auto', padding: '5px 12px', borderRadius: '20px',
              border: '1px solid #FECACA', background: '#FEF2F2',
              color: '#DC2626', fontFamily: 'Cairo, sans-serif',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            إلغاء التصفيات ✕
          </button>
        )}
      </div>
    </div>
  );
}
