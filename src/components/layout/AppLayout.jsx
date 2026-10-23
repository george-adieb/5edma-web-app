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
    setSidebarOpen(false);            // always close the drawer after navigating
  }, [location.pathname]);

  // lock background scroll while the mobile drawer is open; Esc closes it
  useEffect(() => {
    document.body.classList.toggle('drawer-open', sidebarOpen);
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', onKey); };
  }, [sidebarOpen]);

  // pages that fill the screen themselves (no page scroll): the map and the chat
  const isMapPage = location.pathname.startsWith('/followup/map') || location.pathname.startsWith('/ai-assistant');

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
        <div className={`page-content${isMapPage ? ' page-content--map' : ''}`}>
          <Outlet context={{ globalSearch, setGlobalSearch }} />
        </div>
      </div>
    </div>
  );
}
