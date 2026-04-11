import { Settings } from 'lucide-react';
import { currentUser } from '../data/mockData';

export default function SettingsPage() {
  return (
    <div className="animate-fade-in text-right">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1">إدارة إعدادات الحساب والتطبيق</p>
      </div>

      <div className="card max-w-lg">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black"
            style={{ background: currentUser.avatarColor }}
          >
            {currentUser.avatar}
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{currentUser.name}</p>
            <p className="text-sm text-gray-500">{currentUser.role}</p>
            <p className="text-xs text-gray-400 mt-0.5">{currentUser.church}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{ background: '#FEF9C3', color: '#92400E' }}
        >
          <Settings size={16} />
          <span>صفحة الإعدادات قيد التطوير</span>
        </div>
      </div>
    </div>
  );
}
