import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();

  useEffect(() => {
    setGlobalSearch('');
  }, [location.pathname]);

  const openSidebar  = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-layout">
      {/* Sidebar — off-canvas on mobile, fixed on desktop */}
      <div className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Mobile overlay — tapping closes the sidebar */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* Main content */}
      <div className="main-content">
        <TopBar onMenuClick={openSidebar} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} />
        <div className="page-content">
          <Outlet context={{ globalSearch, setGlobalSearch }} />
        </div>
      </div>
    </div>
  );
}
