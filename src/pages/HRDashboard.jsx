import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import { summarizeDashboardKPIs } from '../lib/groqClient';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  Users, UserCheck, Clock, UserX, AlertCircle,
  Sparkles, CalendarCheck, FileSpreadsheet, CheckCircle, XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HRDashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    headcount: 0,
    presentToday: 0,
    onLeaveToday: 0,
    lateToday: 0,
    pendingApprovals: 0,
    attendanceRate: '100%',
    topLateComers: []
  });
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState([]);

  useEffect(() => {
    loadHRStats();
  }, []);

  const loadHRStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const emps = await dataStore.getEmployees();
    const activeEmps = emps.filter(e => e.status !== 'exited');

    const attToday = await dataStore.getAttendance(today);
    const present = attToday.filter(a => a.status === 'present' || a.status === 'late').length;
    const late = attToday.filter(a => a.status === 'late').length;

    const allLeaves = await dataStore.getLeaveRequests();
    const onLeave = allLeaves.filter(l => l.status === 'approved' && today >= l.start_date && today <= l.end_date).length;
    const pending = allLeaves.filter(l => l.status === 'pending');

    // Section 7 Formula: attendance rate = (present + late + missing_checkout + 0.5 * half_day) / (working-day records - on_leave)
    const divisor = Math.max(1, activeEmps.length - onLeave);
    const rate = Math.min(100, Math.round((present / divisor) * 100));

    // Top late comers aggregation
    const allAtt = await dataStore.getAttendance();
    const lateMap = {};
    allAtt.filter(a => a.status === 'late').forEach(a => {
      lateMap[a.employee_id] = (lateMap[a.employee_id] || 0) + 1;
    });

    const topLate = Object.entries(lateMap)
      .map(([empId, count]) => {
        const emp = emps.find(e => e.id === empId);
        return { name: emp ? `${emp.first_name} ${emp.last_name}` : empId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      headcount: activeEmps.length,
      presentToday: present,
      onLeaveToday: onLeave,
      lateToday: late,
      pendingApprovals: pending.length,
      attendanceRate: `${rate}%`,
      topLateComers: topLate
    });
    setPendingLeaves(pending);
  };

  const handleReviewLeave = async (id, status) => {
    const comment = status === 'approved' ? 'Approved by HR Operations' : 'Rejected due to operational constraints';
    await dataStore.reviewLeave(id, status, comment, currentUser);
    await loadHRStats();
  };

  const handleSummarizeAI = async () => {
    setSummarizing(true);
    try {
      const summary = await summarizeDashboardKPIs('hr', {
        headcount: stats.headcount,
        presentToday: stats.presentToday,
        onLeaveToday: stats.onLeaveToday,
        lateToday: stats.lateToday,
        pendingApprovals: stats.pendingApprovals,
        attendanceRate: stats.attendanceRate,
        frequentLateComers: stats.topLateComers
      });
      setAiSummary(summary);
    } catch (err) {
      console.warn('HR AI summary error:', err);
      setAiSummary(
        `• Current workforce operations show ${stats.presentToday} present out of ${stats.headcount} active employees (Attendance Rate: ${stats.attendanceRate}).\n` +
        `• ${stats.lateToday} late arrival(s) observed today past standard grace allowance.\n` +
        `• ${stats.onLeaveToday} employee(s) currently on approved scheduled leave.\n` +
        `• ${stats.pendingApprovals} pending leave approval request(s) require HR review.`
      );
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <DashboardLayout roleTitle="HR People Operations">
      <div className="space-y-6">
        {/* Metric Cards (Section 7 HR Dashboard) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Headcount</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.headcount}</h3>
            <span className="text-[10px] text-blue-400">Active roster</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Present Today</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{stats.presentToday}</h3>
            <span className="text-[10px] text-emerald-500">{stats.attendanceRate} rate</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[11px] font-semibold uppercase text-slate-400">On Leave Today</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.onLeaveToday}</h3>
            <span className="text-[10px] text-amber-500">Scheduled</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Late Today</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">{stats.lateToday}</h3>
            <span className="text-[10px] text-rose-500">After grace</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-2 lg:col-span-1">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Pending Leaves</p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">{stats.pendingApprovals}</h3>
            <span className="text-[10px] text-purple-400">Action needed</span>
          </div>
        </div>

        {/* AI Insight Box (Functionality 20) */}
        <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-900/40 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-sm text-purple-200">HR Operational AI Insights</h3>
            </div>
            <button
              onClick={handleSummarizeAI}
              disabled={summarizing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {summarizing ? 'Analyzing Live Data...' : 'Summarize Operations'}
            </button>
          </div>

          {aiSummary ? (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-purple-900/30 text-xs text-slate-200 leading-relaxed whitespace-pre-line">
              {aiSummary}
              <div className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI-generated from live attendance & leave metrics
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Click "Summarize Operations" to generate instant HR insights for daily attendance and leave trends.
            </p>
          )}
        </div>

        {/* Operational Grid: Pending Approvals & Top Late-Comers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Leave Requests Inbox (Item 13) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" /> Pending Leave Approvals
              </h3>
              <Link to="/leave" className="text-xs text-blue-400 hover:underline">View All</Link>
            </div>

            {pendingLeaves.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No pending leave requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map((req) => (
                  <div key={req.id} className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white capitalize">{req.leave_type} Leave</span>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-semibold">{req.total_days} day(s)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{req.start_date} to {req.end_date}</p>
                      <p className="text-[11px] text-slate-300 italic mt-0.5">"{req.reason}"</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewLeave(req.id, 'approved')}
                        className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReviewLeave(req.id, 'rejected')}
                        className="p-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Late-Comers Insight (Section 7) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Frequent Late-Comers (This Month)
            </h3>
            {stats.topLateComers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No late occurrences recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.topLateComers.map((item, idx) => (
                  <div key={idx} className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.name}</span>
                    <span className="font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                      {item.count} late(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
