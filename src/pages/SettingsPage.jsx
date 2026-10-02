import { Settings, RefreshCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in text-right font-['Cairo']">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1">إدارة إعدادات الحساب والتطبيق</p>
      </div>

      <div className="card max-w-lg mb-6 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black"
            style={{ background: profile?.avatar_color || '#8B1A1A' }}
          >
            {profile?.full_name?.charAt(0) || '؟'}
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{profile?.full_name}</p>
            <p className="text-sm text-gray-500">{profile?.role}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4"
          style={{ background: '#FEF9C3', color: '#92400E' }}
        >
          <Settings size={16} />
          <span>هذه الصفحة قيد التطوير</span>
        </div>
      </div>

      {profile?.role === 'ADMIN' && (
        <div className="card max-w-lg p-5 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2 border-gray-100">أدوات الإدارة (Admin)</h2>
          
          <button
            onClick={() => navigate('/settings/yearly-promotion')}
            className="flex items-center gap-3 w-full p-4 rounded-xl text-right transition-colors"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2', color: '#8B1A1A' }}>
              <RefreshCcw size={20} />
            </div>
            <div>
              <p className="font-bold text-[15px] text-gray-900 mb-0.5">ترحيل السنة الدراسية</p>
              <p className="text-[12px] text-gray-500">ترحيل كافة المخدومين والخدام للسنة التالية</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
