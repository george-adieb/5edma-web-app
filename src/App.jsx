import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import AttendancePage from './pages/AttendancePage';
import StudentsPage from './pages/StudentsPage';
import ServantsPage from './pages/ServantsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import FollowUpPage from './pages/FollowUpPage';
import SettingsPage from './pages/SettingsPage';
import AddStudentPage from './pages/AddStudentPage';
import EditStudentPage from './pages/EditStudentPage';
import LoginPage from './pages/LoginPage';
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

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
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
      { path: 'followup', element: <FollowUpPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
