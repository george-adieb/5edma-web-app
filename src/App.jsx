import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import AttendancePage from './pages/AttendancePage';
import StudentsPage from './pages/StudentsPage';
import ServantsPage from './pages/ServantsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import FollowUpPage from './pages/FollowUpPage';
import FollowUpMapPage from './pages/FollowUpMapPage';
import SettingsPage from './pages/SettingsPage';
import AddStudentPage from './pages/AddStudentPage';
import EditStudentPage from './pages/EditStudentPage';
import UserManagementPage from './pages/UserManagementPage';
import StageServantsPage from './pages/StageServantsPage';
import LoginPage from './pages/LoginPage';
import MyPointsPage from './pages/MyPointsPage';
import PublicUpdateDataPage from './pages/PublicUpdateDataPage';
import AIAssistantPage from './pages/AIAssistantPage';
import YearlyPromotionPage from './pages/YearlyPromotionPage';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still resolving session — show spinner, never redirect yet
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl', fontFamily: 'Cairo, sans-serif', gap: '10px' }}>
      <svg style={{ animation: 'spin 1s linear infinite', color: '#8B1A1A' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span style={{ fontSize: '14px', color: '#9CA3AF' }}>جاري التحميل...</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;


  return children;
}

// Client-side route guard (UX only — the real enforcement is in RLS and the Edge Functions).
function RoleRoute({ roles, children }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}

function NewServantRedirect() {
  const { profile } = useAuth();
  if (profile?.role === 'ADMIN') return <Navigate to="/settings/users" replace />;
  if (profile?.role === 'SERVICE_HEAD') return <Navigate to="/servants/manage" replace />;
  return <Navigate to="/servants" replace />;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/update-data',
    element: <PublicUpdateDataPage />
  },
  {
    path: '/my-points',
    element: <MyPointsPage />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/new', element: <AddStudentPage /> },
      { path: 'students/edit/:id', element: <EditStudentPage /> },
      { path: 'students/:id', element: <StudentProfilePage /> },
      { path: 'servants', element: <ServantsPage /> },
      { path: 'servants/new', element: <NewServantRedirect /> },
      { path: 'servants/manage', element: <RoleRoute roles={['SERVICE_HEAD']}><StageServantsPage /></RoleRoute> },
      { path: 'followup', element: <FollowUpPage /> },
      { path: 'followup/map', element: <FollowUpMapPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/users', element: <RoleRoute roles={['ADMIN']}><UserManagementPage /></RoleRoute> },
      { path: 'settings/yearly-promotion', element: <YearlyPromotionPage /> },
      { path: 'ai-assistant', element: <AIAssistantPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
