import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import { ShieldCheck, Building2, MapPin, Clock, ArrowRight } from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Company Profile & Rules
    companyName: 'Saylani Tech Solutions',
    officeStart: '09:00',
    graceMinutes: 15,
    halfDayHours: 5.0,
    officeLat: 24.8607,
    officeLng: 67.0011,
    radiusMeters: 150,

    // Admin Credentials
    adminEmail: 'admin@saylanihcm.com',
    adminPassword: 'Password123!',
    confirmPassword: 'Password123!'
  });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSetupComplete = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.adminPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.adminPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // 1. Save Company Settings
      const company = await dataStore.saveCompany({
        name: formData.companyName,
        office_start: formData.officeStart + ':00',
        grace_minutes: Number(formData.graceMinutes),
        half_day_hours: Number(formData.halfDayHours),
        weekend_days: [0, 6],
        office_lat: Number(formData.officeLat),
        office_lng: Number(formData.officeLng),
        radius_meters: Number(formData.radiusMeters)
      }, { id: 'setup', email: 'system', role: 'admin' });

      // 2. Create Initial Admin Profile
      const adminUser = await dataStore.saveUser({
        email: formData.adminEmail,
        password: formData.adminPassword,
        role: 'admin',
        status: 'active',
        must_change_password: false
      }, { id: 'setup', email: 'system', role: 'admin' });

      // 3. Pre-create default master data (Departments & Leave types) for immediate testability
      const dept1 = await dataStore.addDepartment({ name: 'Engineering', code: 'ENG' }, adminUser);
      const dept2 = await dataStore.addDepartment({ name: 'Human Resources', code: 'HR' }, adminUser);
      await dataStore.addDesignation({ title: 'Full Stack Engineer', department_id: dept1.id }, adminUser);
      await dataStore.addDesignation({ title: 'HR Specialist', department_id: dept2.id }, adminUser);

      // Post welcome announcement
      await dataStore.postAnnouncement({
        title: 'Welcome to HCM Lite!',
        content: `HCM Lite system initialized for ${formData.companyName}. All operations ready.`,
        priority: 'urgent'
      }, adminUser);

      await refreshUser();
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">First-Run System Setup</h1>
            <p className="text-sm text-slate-400">Initialize company settings, rules & first Admin account</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSetupComplete} className="space-y-6">
          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                <Clock className="w-5 h-5" /> 1. Company Profile & Timing Rules
              </h2>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Office Start</label>
                  <input
                    type="time"
                    name="officeStart"
                    value={formData.officeStart}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Grace Period</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="graceMinutes"
                      value={formData.graceMinutes}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">min</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Half Day Limit</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      name="halfDayHours"
                      value={formData.halfDayHours}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">hrs</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/40 border border-slate-700/60 rounded-xl space-y-3">
                <h3 className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Geofence Geolocation (M4 Camera Bonus)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Office Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      name="officeLat"
                      value={formData.officeLat}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Office Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      name="officeLng"
                      value={formData.officeLng}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Radius (Meters)</label>
                    <input
                      type="number"
                      name="radiusMeters"
                      value={formData.radiusMeters}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl flex items-center justify-center gap-2 transition"
              >
                Next: Admin Account <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> 2. Create Initial Admin Account
              </h2>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Admin Email</label>
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? 'Initializing System...' : 'Finish Setup & Launch'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
