import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import {
  Building2, Users, CalendarCheck, FileText,
  DollarSign, BarChart3, Bot, Bell, Shield, LogOut,
  ChevronRight, Sparkles, AlertCircle, X, CheckCircle, KeyRound, Smartphone
} from 'lucide-react';
import AIChatDrawer from '../features/ai/AIChatDrawer';

export default function DashboardLayout({ children, roleTitle }) {
  const { currentUser, currentEmployee, logout, changePassword } = useAuth();
  const navigate = useNavigate();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Change Password Modal State
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const role = currentUser?.role || 'employee';

  useEffect(() => {
    if (currentUser?.id) {
      loadNotifications();
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    try {
      const list = await dataStore.getNotifications(currentUser.id);
      if (list.length === 0) {
        setNotifications([
          {
            id: 'n1',
            title: 'Welcome to HCM Lite',
            message: `Logged in as ${role.toUpperCase()}. System is fully synchronized with database.`,
            type: 'info',
            created_at: new Date().toISOString()
          }
        ]);
      } else {
        setNotifications(list);
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwNew !== pwConfirm) {
      setPwError('New passwords do not match');
      return;
    }
    if (pwNew.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }

    setPwSaving(true);
    try {
      await changePassword(pwNew);
      setPwSuccess('Password changed successfully!');
      setTimeout(() => {
        setShowChangePwModal(false);
        setPwCurrent('');
        setPwNew('');
        setPwConfirm('');
        setPwSuccess('');
      }, 1200);
    } catch (err) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: `/${role}`, icon: BarChart3, roles: ['admin', 'hr', 'employee'] },
    { name: 'Company & Setup', path: '/admin/settings', icon: Building2, roles: ['admin'] },
    { name: 'User Access', path: '/admin/users', icon: Shield, roles: ['admin'] },
    { name: 'Employees', path: '/employees', icon: Users, roles: ['admin', 'hr'] },
    { name: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: ['admin', 'hr', 'employee'] },
    { name: 'Leave Management', path: '/leave', icon: FileText, roles: ['admin', 'hr', 'employee'] },
    { name: 'Payroll', path: '/payroll', icon: DollarSign, roles: ['admin', 'hr', 'employee'] },
    { name: 'Audit Logs', path: '/admin/audit', icon: Shield, roles: ['admin'] },
  ].filter(item => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">HCM Lite</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {roleTitle || role.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/${role}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* AI Assistant Quick Trigger */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setIsAiOpen(true)}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:via-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-between shadow-lg shadow-purple-600/20 transition group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
              <span>Groq AI Assistant</span>
            </div>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">70B</span>
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
              {currentUser?.email?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">{currentUser?.email}</p>
              <p className="text-[10px] text-slate-500 uppercase">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowChangePwModal(true)}
              title="Change Password"
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/40 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-lg font-bold text-white capitalize">{roleTitle || `${role} Portal`}</h1>
          <div className="flex items-center gap-3">
            {/* Quick Action: Change Password */}
            <button
              onClick={() => setShowChangePwModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Change your account password"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Change Password</span>
            </button>

            {/* Notification Bell with Badge */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 relative transition border border-slate-700"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                    <span className="font-bold text-white">System Notifications</span>
                    <button
                      onClick={() => setShowNotifDropdown(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2.5 bg-slate-800/60 rounded-xl text-[11px] space-y-0.5">
                        <p className="font-semibold text-purple-300">{n.title}</p>
                        <p className="text-slate-300 leading-snug">{n.message}</p>
                        <p className="text-[9px] text-slate-500 pt-1">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsAiOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <span>Ask AI</span>
            </button>
            {/* User Details & Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold border border-rose-500/20 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 flex-1">
          {children}
        </div>
      </main>

      {/* Embedded M8 AI Assistant Drawer */}
      <AIChatDrawer isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />

      {/* Change Password Modal */}
      {showChangePwModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Change Password</h3>
              </div>
              <button
                onClick={() => { setShowChangePwModal(false); setPwError(''); setPwSuccess(''); }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}
            {pwSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePwModal(false)}
                  className="w-1/2 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                  {pwSaving ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
