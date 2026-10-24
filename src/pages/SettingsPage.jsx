import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import DashboardLayout from '../layouts/DashboardLayout';
import { Building2, Plus, Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const [company, setCompany] = useState({
    name: '',
    office_start: '09:00:00',
    grace_minutes: 15,
    half_day_hours: 5.0,
    office_lat: 24.8607,
    office_lng: 67.0011,
    radius_meters: 150
  });

  const [departments, setDepartments] = useState([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const comp = await dataStore.getCompany();
    if (comp) setCompany(comp);
    const depts = await dataStore.getDepartments();
    setDepartments(depts);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      await dataStore.saveCompany(company, currentUser);
      setSuccessMsg('Company rules & geofence coordinates saved successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      await dataStore.addDepartment({ name: newDeptName, code: newDeptCode }, currentUser);
      setNewDeptName('');
      setNewDeptCode('');
      setSuccessMsg('Department added.');
      await loadSettings();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add department');
    }
  };

  return (
    <DashboardLayout roleTitle="Company Settings & Rules">
      <div className="max-w-4xl space-y-6">
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Company Profile & Rules (Item 03) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Office Timing & Geofence Rules</h3>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={company.name}
                onChange={(e) => setCompany(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Office Start</label>
                <input
                  type="time"
                  value={company.office_start?.substring(0, 5)}
                  onChange={(e) => setCompany(prev => ({ ...prev, office_start: e.target.value + ':00' }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Grace Period (min)</label>
                <input
                  type="number"
                  value={company.grace_minutes}
                  onChange={(e) => setCompany(prev => ({ ...prev, grace_minutes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Half Day Limit (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  value={company.half_day_hours}
                  onChange={(e) => setCompany(prev => ({ ...prev, half_day_hours: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Office Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={company.office_lat}
                  onChange={(e) => setCompany(prev => ({ ...prev, office_lat: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Office Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={company.office_lng}
                  onChange={(e) => setCompany(prev => ({ ...prev, office_lng: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Radius (Meters)</label>
                <input
                  type="number"
                  value={company.radius_meters}
                  onChange={(e) => setCompany(prev => ({ ...prev, radius_meters: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
            >
              Update Company Settings
            </button>
          </form>
        </div>

        {/* Master Departments (Item 04) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Departments</h3>
          </div>

          <form onSubmit={handleAddDept} className="flex gap-3">
            <input
              type="text"
              placeholder="Department Name (e.g. Finance)"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            />
            <input
              type="text"
              placeholder="Code (e.g. FIN)"
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value)}
              className="w-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {departments.map((d) => (
              <div key={d.id} className="p-3 bg-slate-800/50 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                <span className="font-semibold text-white">{d.name}</span>
                <span className="font-mono text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">{d.code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
