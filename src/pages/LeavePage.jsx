import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  FileText, Calendar, AlertCircle, CheckCircle,
  Plus, Check, X, Clock, XCircle
} from 'lucide-react';

export default function LeavePage() {
  const { currentUser, currentEmployee } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Apply Leave Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadLeaveData();
  }, [currentEmployee]);

  const loadLeaveData = async () => {
    try {
      const emps = await dataStore.getEmployees();
      const allReqs = await dataStore.getLeaveRequests();
      setEmployees(emps);

      if (currentUser?.role === 'employee' && currentEmployee) {
        setLeaveRequests(allReqs.filter(r => r.employee_id === currentEmployee.id));
        const bals = await dataStore.getLeaveBalances(currentEmployee.id);
        setLeaveBalances(bals);
      } else {
        setLeaveRequests(allReqs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await dataStore.applyLeave({
        employee_id: currentEmployee.id,
        leave_type: applyForm.leave_type,
        start_date: applyForm.start_date,
        end_date: applyForm.end_date,
        reason: applyForm.reason
      }, currentUser);

      setSuccessMsg('Leave request submitted successfully.');
      setShowApplyModal(false);
      setApplyForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      await loadLeaveData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit leave request');
    }
  };

  const handleReview = async (id, status) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const comment = status === 'approved' ? 'Approved by HR' : 'Declined by HR';
      await dataStore.reviewLeave(id, status, comment, currentUser);
      setSuccessMsg(`Leave request ${status}.`);
      await loadLeaveData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to review leave');
    }
  };

  const handleCancelLeave = async (id) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Build actor context with employee_id for ownership check
      const actor = { ...currentUser, employee_id: currentEmployee?.id };
      await dataStore.cancelLeave(id, actor);
      setSuccessMsg('Leave request cancelled successfully.');
      await loadLeaveData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel leave');
    }
  };

  const statusBadge = (status) => {
    const map = {
      approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      rejected: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      cancelled: 'bg-slate-700/50 text-slate-400 border border-slate-700',
      pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    };
    return map[status] || map.pending;
  };

  return (
    <DashboardLayout roleTitle="Leave Management">
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Leave Requests & Approvals</h3>
          </div>

          {currentUser?.role === 'employee' && (
            <button
              onClick={() => setShowApplyModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          )}
        </div>

        {/* Employee Balances Summary (Item 12) */}
        {currentUser?.role === 'employee' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {leaveBalances.map((b) => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">{b.type} Leave</span>
                <h4 className="text-xl font-bold text-white mt-1">{b.quota - b.used}</h4>
                <p className="text-[11px] text-slate-500">{b.used} used of {b.quota} quota</p>
              </div>
            ))}
          </div>
        )}

        {/* Leave Requests Table (Item 12 & 13) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                {currentUser?.role !== 'employee' && <th className="px-5 py-3.5">Employee</th>}
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Dates</th>
                <th className="px-5 py-3.5">Working Days</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : leaveRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                leaveRequests.map((req) => {
                  const emp = employees.find(e => e.id === req.employee_id);
                  return (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition">
                      {currentUser?.role !== 'employee' && (
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {emp ? `${emp.first_name} ${emp.last_name}` : req.employee_id}
                        </td>
                      )}
                      <td className="px-5 py-3.5 capitalize font-medium text-purple-300">{req.leave_type || '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">{req.start_date} → {req.end_date}</td>
                      <td className="px-5 py-3.5 font-bold text-white">{req.total_days} d</td>
                      <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">{req.reason}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {/* HR/Admin: Approve or Reject pending requests */}
                        {(currentUser?.role === 'hr' || currentUser?.role === 'admin') && req.status === 'pending' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleReview(req.id, 'approved')}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReview(req.id, 'rejected')}
                              className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {/* Employee: Cancel own pending requests */}
                        {currentUser?.role === 'employee' && req.status === 'pending' && (
                          <button
                            onClick={() => handleCancelLeave(req.id)}
                            className="px-2.5 py-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 ml-auto"
                            title="Cancel Request"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                        {/* Reviewed or cancelled: show nothing meaningful */}
                        {req.status !== 'pending' && (
                          <span className="text-[10px] text-slate-600 uppercase">{req.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Apply Leave Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="font-bold text-white text-base">Apply for Leave</h3>
              <form onSubmit={handleApplyLeave} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Leave Type</label>
                  <select
                    value={applyForm.leave_type}
                    onChange={(e) => setApplyForm(prev => ({ ...prev, leave_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="annual">Annual Leave (Quota 14)</option>
                    <option value="sick">Sick Leave (Quota 8)</option>
                    <option value="casual">Casual Leave (Quota 10)</option>
                    <option value="unpaid">Unpaid Leave (Unlimited)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={applyForm.start_date}
                      onChange={(e) => setApplyForm(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={applyForm.end_date}
                      onChange={(e) => setApplyForm(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Reason</label>
                  <textarea
                    required
                    rows={2}
                    value={applyForm.reason}
                    onChange={(e) => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white resize-none"
                  />
                </div>

                {errorMsg && (
                  <p className="text-rose-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowApplyModal(false); setErrorMsg(''); }}
                    className="w-1/2 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
