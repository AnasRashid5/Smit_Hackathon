import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import AdminDashboard from './pages/AdminDashboard';
import HRDashboard from './pages/HRDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import PayrollPage from './pages/PayrollPage';
import SettingsPage from './pages/SettingsPage';
import UserAccessPage from './pages/UserAccessPage';
import AuditLogPage from './pages/AuditLogPage';

// Protected Route Guard with RBAC check
function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, loading, isFirstRun } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Initializing HCM Lite Application...
      </div>
    );
  }

  // If first run, divert to setup
  if (isFirstRun) {
    return <Navigate to="/setup" replace />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to their assigned home dashboard
    if (currentUser.role === 'admin') return <Navigate to="/admin" replace />;
    if (currentUser.role === 'hr') return <Navigate to="/hr" replace />;
    return <Navigate to="/employee" replace />;
  }

  return children;
}

export default function App() {
  const { currentUser, isFirstRun, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading HCM Lite...
      </div>
    );
  }

  return (
    <Routes>
      {/* Public / Setup Routes */}
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={
        currentUser ? (
          currentUser.role === 'admin' ? <Navigate to="/admin" /> :
          currentUser.role === 'hr' ? <Navigate to="/hr" /> : <Navigate to="/employee" />
        ) : isFirstRun ? (
          <Navigate to="/setup" />
        ) : (
          <LoginPage />
        )
      } />

      {/* Role Dashboards */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/hr" element={
        <ProtectedRoute allowedRoles={['hr']}>
          <HRDashboard />
        </ProtectedRoute>
      } />
      <Route path="/employee" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <EmployeeDashboard />
        </ProtectedRoute>
      } />

      {/* Shared Modular Screens */}
      <Route path="/employees" element={
        <ProtectedRoute allowedRoles={['admin', 'hr']}>
          <EmployeesPage />
        </ProtectedRoute>
      } />
      <Route path="/attendance" element={
        <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
          <AttendancePage />
        </ProtectedRoute>
      } />
      <Route path="/leave" element={
        <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
          <LeavePage />
        </ProtectedRoute>
      } />
      <Route path="/payroll" element={
        <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
          <PayrollPage />
        </ProtectedRoute>
      } />

      {/* Admin Specific Screens */}
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <UserAccessPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/audit" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AuditLogPage />
        </ProtectedRoute>
      } />

      {/* Fallback Root */}
      <Route path="*" element={
        isFirstRun ? <Navigate to="/setup" replace /> :
        currentUser ? (
          currentUser.role === 'admin' ? <Navigate to="/admin" replace /> :
          currentUser.role === 'hr' ? <Navigate to="/hr" replace /> : <Navigate to="/employee" replace />
        ) : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}
