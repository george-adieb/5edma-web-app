// Reusable Badge component
export function Badge({ type, children }) {
  const styles = {
    منتظم: 'badge badge-green',
    جديد: 'badge badge-blue',
    'يحتاج افتقاد': 'badge badge-red',
    حاضر: 'badge badge-green',
    غائب: 'badge badge-red',
    معتذر: 'badge badge-yellow',
    عاجل: 'badge badge-red',
    'تم التواصل': 'badge badge-green',
    'يحتاج متابعة': 'badge badge-yellow',
  };

  const className = styles[type] || 'badge badge-gray';

  return <span className={className}>{children || type}</span>;
}

// Avatar component
export function Avatar({ initials, color, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  return (
    <div
      className={`avatar ${sizes[size]} text-white font-bold`}
      style={{ background: color || '#8B1A1A' }}
    >
      {initials}
    </div>
  );
}

// Stat Card component
export function StatCard({ title, value, subtitle, icon, color = 'red', onClick }) {
  const colors = {
    red: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    green: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    yellow: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    blue: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    gold: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  };

  const c = colors[color] || colors.red;

  return (
    <div
      className={`card cursor-pointer hover:shadow-md transition-all duration-200 ${onClick ? 'hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
      style={{ borderColor: c.border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: c.bg }}
        >
          {icon}
        </div>
        <div className="text-right flex-1 mr-3">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold leading-none" style={{ color: c.text }}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// Section Header
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-right">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-semibold transition-colors hover:underline"
          style={{ color: '#8B1A1A' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Empty State
export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// Search Input
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'بحث...'}
        className="input-field pr-10"
      />
    </div>
  );
}

// Page Title
export function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-6 text-right">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// Filter Pills
export function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
            value === opt.id
              ? 'text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={value === opt.id ? { background: '#8B1A1A' } : {}}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
