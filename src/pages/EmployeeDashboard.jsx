import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import { generatePayslipPDF } from '../lib/pdfGenerator';
import { parseLeaveNLP } from '../lib/groqClient';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  Clock, Calendar, FileText, Download,
  CheckCircle2, AlertCircle, Sparkles, Send, Bell
} from 'lucide-react';

export default function EmployeeDashboard() {
  const { currentUser, currentEmployee } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Smart Leave Form Modal
  const [smartLeaveOpen, setSmartLeaveOpen] = useState(false);
  const [smartLeavePrompt, setSmartLeavePrompt] = useState('');
  const [parsedLeave, setParsedLeave] = useState(null);
  const [parsingNLP, setParsingNLP] = useState(false);

  useEffect(() => {
    loadEmployeeDashboard();
  }, [currentEmployee]);

  const loadEmployeeDashboard = async () => {
    if (!currentEmployee) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const allAtt = await dataStore.getAttendance();
      const myAtt = allAtt.filter(a => a.employee_id === currentEmployee.id);
      
      const todayRec = myAtt.find(a => a.date === today);
      setTodayRecord(todayRec || null);

      // Total hours and late count
      const totalHrs = myAtt.reduce((acc, curr) => acc + (Number(curr.total_hours) || 0), 0);
      const lates = myAtt.filter(a => a.status === 'late').length;
      setHoursThisWeek(totalHrs);
      setLateCount(lates);

      // Leave balances
      const balances = await dataStore.getLeaveBalances(currentEmployee.id);
      setLeaveBalances(balances);

      // Last Payslip
      const payslips = await dataStore.getPayslips();
      const myPayslips = payslips.filter(p => p.employee_id === currentEmployee.id);
      setLatestPayslip(myPayslips[myPayslips.length - 1] || null);

      // Announcements
      const ann = await dataStore.getAnnouncements();
      setAnnouncements(ann);
    } catch (err) {
      console.error('Error loading employee dashboard:', err);
    }
  };

  const handleWebCheckIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setCheckingIn(true);

    try {
      const rec = await dataStore.checkIn(currentEmployee.id, null, 'web');
      setTodayRecord(rec);
      setSuccessMsg(`Checked in successfully at ${new Date(rec.check_in).toLocaleTimeString()} (${rec.status.toUpperCase()})`);
      await loadEmployeeDashboard();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleWebCheckOut = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const rec = await dataStore.checkOut(currentEmployee.id);
      setTodayRecord(rec);
      setSuccessMsg(`Checked out at ${new Date(rec.check_out).toLocaleTimeString()}. Total: ${rec.total_hours} hrs (${rec.status.toUpperCase()})`);
      await loadEmployeeDashboard();
    } catch (err) {
      setErrorMsg(err.message || 'Check-out failed');
    }
  };

  // Smart Leave Parser (Feature 21: "Need next Monday and Tuesday off for sister's wedding" -> pre-filled form)
  // Powered by Groq Llama 3.3 70B
  const handleParseSmartLeave = async () => {
    if (!smartLeavePrompt.trim()) return;
    setParsingNLP(true);
    setErrorMsg('');

    try {
      const parsed = await parseLeaveNLP(smartLeavePrompt);
      setParsedLeave(parsed);
    } catch (err) {
      console.error('NLP parse error:', err);
      // Fallback
      const now = new Date();
      const nextMon = new Date(now.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7)));
      const nextTue = new Date(nextMon);
      nextTue.setDate(nextMon.getDate() + 1);
      const isSick = /sick|doctor|fever|medical/i.test(smartLeavePrompt);
      setParsedLeave({
        leave_type: isSick ? 'sick' : 'casual',
        start_date: nextMon.toISOString().split('T')[0],
        end_date: nextTue.toISOString().split('T')[0],
        reason: smartLeavePrompt
      });
    } finally {
      setParsingNLP(false);
    }
  };

  const handleConfirmSmartLeave = async () => {
    if (!parsedLeave) return;
    try {
      await dataStore.applyLeave({
        employee_id: currentEmployee.id,
        leave_type: parsedLeave.leave_type,
        start_date: parsedLeave.start_date,
        end_date: parsedLeave.end_date,
        reason: parsedLeave.reason
      }, currentUser);

      setSuccessMsg('Smart leave request submitted for HR approval!');
      setSmartLeaveOpen(false);
      setParsedLeave(null);
      setSmartLeavePrompt('');
      await loadEmployeeDashboard();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit leave');
    }
  };

  const handleDownloadPayslip = async () => {
    if (!latestPayslip || !currentEmployee) return;
    const company = await dataStore.getCompany();
    const runs = await dataStore.getPayrollRuns();
    const run = runs.find(r => r.id === latestPayslip.payroll_run_id) || { month: 10, year: 2026 };
    generatePayslipPDF(latestPayslip, currentEmployee, company, run);
  };

  return (
    <DashboardLayout roleTitle="Employee Self-Service">
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Check-In Widget & Work Hours (Section 7 Employee Dashboard) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily Attendance Clock Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase text-slate-400">Daily Attendance</span>
                <span className="text-xs font-mono text-blue-400">{new Date().toDateString()}</span>
              </div>

              {todayRecord ? (
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Check-In:</span>
                    <span className="font-bold text-white">{new Date(todayRecord.check_in).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Check-Out:</span>
                    <span className="font-bold text-white">{todayRecord.check_out ? new Date(todayRecord.check_out).toLocaleTimeString() : 'In Progress'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-bold uppercase ${todayRecord.status === 'late' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {todayRecord.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  You have not checked in yet today.
                </div>
              )}
            </div>

            <div className="space-y-2">
              {!todayRecord ? (
                <button
                  onClick={handleWebCheckIn}
                  disabled={checkingIn}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Clock className="w-4 h-4" />
                  {checkingIn ? 'Recording...' : 'Web Check-In'}
                </button>
              ) : !todayRecord.check_out ? (
                <button
                  onClick={handleWebCheckOut}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                >
                  <Clock className="w-4 h-4" />
                  Web Check-Out
                </button>
              ) : (
                <div className="p-2.5 bg-slate-800 text-center text-xs text-slate-400 rounded-xl">
                  Attendance completed for today.
                </div>
              )}
            </div>
          </div>

          {/* Hours vs 40h standard & Late Metric */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Hours Logged</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-extrabold text-white">{hoursThisWeek.toFixed(1)}</h3>
                <span className="text-xs text-slate-400">/ 40.0 hrs target</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-2.5 rounded-full"
                  style={{ width: `${Math.min(100, (hoursThisWeek / 40) * 100)}%` }}
                />
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Late Occurrences</span>
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                  {lateCount} time(s)
                </span>
              </div>
            </div>

            <button
              onClick={() => setSmartLeaveOpen(true)}
              className="w-full mt-4 py-2.5 bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Smart Leave in Plain Words (M8)
            </button>
          </div>

          {/* Leave Balances Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-xs uppercase text-slate-400 mb-4">Leave Balances ({new Date().getFullYear()})</h3>
            <div className="space-y-3">
              {leaveBalances.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
                  <span className="font-medium text-slate-300 capitalize">{b.type}</span>
                  <div className="text-right">
                    <span className="font-bold text-blue-400">{b.quota - b.used}</span>
                    <span className="text-slate-500 text-[10px]"> / {b.quota} left</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Last Payslip Quick Download */}
            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-300">Latest Payslip</p>
                  <p className="text-[11px] text-slate-500">
                    {latestPayslip ? `PKR ${Number(latestPayslip.net_salary).toLocaleString()}` : 'No payslip yet'}
                  </p>
                </div>
                {latestPayslip && (
                  <button
                    onClick={handleDownloadPayslip}
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                    title="Download Payslip PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company Announcements (Item 23) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" /> Announcements
          </h3>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500">No company announcements at this time.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white">{a.title}</h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-300">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Smart Leave Modal (Functionality 21) */}
        {smartLeaveOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Smart Leave Request</h3>
                  <p className="text-xs text-slate-400">Type what you need in plain words (e.g., "Need next Mon & Tue for sister wedding")</p>
                </div>
              </div>

              <textarea
                value={smartLeavePrompt}
                onChange={(e) => setSmartLeavePrompt(e.target.value)}
                rows={3}
                placeholder="E.g. I need next Monday and Tuesday off for family wedding"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />

              <button
                type="button"
                onClick={handleParseSmartLeave}
                disabled={parsingNLP || !smartLeavePrompt.trim()}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition"
              >
                {parsingNLP ? 'Analyzing Natural Language...' : 'Pre-Fill Form'}
              </button>

              {parsedLeave && (
                <div className="p-4 bg-slate-800/80 border border-purple-500/30 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-purple-300">Parsed Leave Details:</p>
                  <p><strong className="text-slate-400">Type:</strong> <span className="text-white capitalize">{parsedLeave.leave_type}</span></p>
                  <p><strong className="text-slate-400">Dates:</strong> <span className="text-white">{parsedLeave.start_date} to {parsedLeave.end_date}</span></p>
                  <p><strong className="text-slate-400">Reason:</strong> <span className="text-white">{parsedLeave.reason}</span></p>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setSmartLeaveOpen(false)}
                      className="w-1/2 py-2 bg-slate-700 text-slate-300 font-semibold rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSmartLeave}
                      className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                    >
                      Confirm & Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
