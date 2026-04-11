import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';

export default function RowActionsMenu({ 
  onEdit, 
  onDelete, 
  editLabel = 'تعديل', 
  deleteLabel = 'حذف',
  confirmDeleteText = 'هل أنت متأكد من الحذف؟'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsConfirming(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setIsConfirming(false);
        }}
        style={{
          padding: '6px', borderRadius: '6px', 
          background: isOpen ? '#F3F4F6' : 'transparent',
          border: 'none', cursor: 'pointer', 
          color: isOpen ? '#111827' : '#9CA3AF',
          transition: 'all 0.15s'
        }}
      >
        <MoreVertical size={15} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: '0', zIndex: 50,
          marginTop: '4px', minWidth: '150px', background: 'white',
          border: '1px solid #E5E7EB', borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden', direction: 'rtl',
        }}>
          {!isConfirming ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onEdit && onEdit();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '10px 14px', background: 'white', border: 'none',
                  cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
                  color: '#374151', textAlign: 'right', borderBottom: '1px solid #F3F4F6',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <Edit size={14} color="#6B7280" />
                {editLabel}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirming(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '10px 14px', background: 'white', border: 'none',
                  cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
                  color: '#DC2626', textAlign: 'right',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <Trash2 size={14} color="#DC2626" />
                {deleteLabel}
              </button>
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#FEF2F2' }}>
              <p style={{ fontSize: '11px', color: '#991B1B', fontWeight: 700, marginBottom: '10px', textAlign: 'center', lineHeight: 1.4 }}>
                {confirmDeleteText}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    setIsConfirming(false);
                    onDelete && onDelete();
                  }}
                  style={{
                    flex: 1, padding: '6px', borderRadius: '6px', background: '#DC2626',
                    color: 'white', border: 'none', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                  }}
                >
                  حذف
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirming(false);
                  }}
                  style={{
                    flex: 1, padding: '6px', borderRadius: '6px', background: 'white',
                    color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: 700,
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
