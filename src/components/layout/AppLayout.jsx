import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <TopBar onMenuClick={openSidebar} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
