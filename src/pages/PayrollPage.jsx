import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import { generatePayslipPDF } from '../lib/pdfGenerator';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  DollarSign, FileSpreadsheet, Lock, Download,
  AlertCircle, CheckCircle, Play, Eye
} from 'lucide-react';

export default function PayrollPage() {
  const { currentUser, currentEmployee } = useAuth();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [company, setCompany] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadPayrollData();
  }, [currentEmployee]);

  const loadPayrollData = async () => {
    try {
      const comp = await dataStore.getCompany();
      const emps = await dataStore.getEmployees();
      const runs = await dataStore.getPayrollRuns();
      const allPayslips = await dataStore.getPayslips();

      setCompany(comp);
      setEmployees(emps);
      setPayrollRuns(runs);

      if (runs.length > 0 && !selectedRun) {
        setSelectedRun(runs[0]);
      }

      if (currentUser?.role === 'employee' && currentEmployee) {
        setPayslips(allPayslips.filter(p => p.employee_id === currentEmployee.id));
      } else {
        setPayslips(allPayslips);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // HR Action: Create Monthly Payroll Draft (Item 15)
  const handleGenerateDraft = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setProcessing(true);

    try {
      const result = await dataStore.createPayrollDraft(Number(month), Number(year), currentUser);
      setSuccessMsg(`Payroll draft generated for ${month}/${year}. Status: DRAFT.`);
      setSelectedRun(result.run);
      await loadPayrollData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate payroll draft');
    } finally {
      setProcessing(false);
    }
  };

  // Admin Action: Finalize & Lock Payroll (Item 16: Only Admin can lock it)
  const handleFinalize = async (runId) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const finalized = await dataStore.finalizePayroll(runId, currentUser);
      setSuccessMsg(`Payroll run ${finalized.month}/${finalized.year} finalized and permanently locked!`);
      await loadPayrollData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to finalize payroll');
    }
  };

  const handleDownloadPDF = (slip) => {
    const emp = employees.find(e => e.id === slip.employee_id);
    const run = payrollRuns.find(r => r.id === slip.payroll_run_id) || { month, year };
    generatePayslipPDF(slip, emp, company, run);
  };

  const displayedSlips = selectedRun
    ? payslips.filter(p => p.payroll_run_id === selectedRun.id)
    : payslips;

  return (
    <DashboardLayout roleTitle="Payroll Engine & Payslips">
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
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Monthly Payroll Processing</h3>
              <p className="text-[11px] text-slate-400">Gross = 1.5x Basic, Tax Slabs, & Attendance Deductions</p>
            </div>
          </div>

          {currentUser?.role === 'hr' && (
            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {[...Array(12).keys()].map(i => (
                  <option key={i + 1} value={i + 1}>Month {i + 1}</option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>

              <button
                onClick={handleGenerateDraft}
                disabled={processing}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{processing ? 'Calculating...' : 'Run Payroll Draft'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Payroll Runs History (Item 15 & 16) */}
        {currentUser?.role !== 'employee' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {payrollRuns.map((run) => (
              <div
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className={`cursor-pointer p-4 rounded-xl border transition ${
                  selectedRun?.id === run.id
                    ? 'bg-slate-800/80 border-blue-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white text-sm">Period: {run.month}/{run.year}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    run.status === 'finalized'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {run.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <p><span className="text-slate-400">Total Gross:</span> <strong className="text-white">PKR {Number(run.total_gross).toLocaleString()}</strong></p>
                  <p><span className="text-slate-400">Total Deductions:</span> <strong className="text-rose-400">PKR {Number(run.total_deductions + run.total_tax).toLocaleString()}</strong></p>
                  <p><span className="text-slate-400">Net Disbursed:</span> <strong className="text-emerald-400">PKR {Number(run.total_net).toLocaleString()}</strong></p>
                </div>

                {currentUser?.role === 'admin' && run.status === 'draft' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFinalize(run.id); }}
                    className="w-full mt-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Finalize & Lock Month</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Payslips Table with PDF Download (Item 17) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h4 className="font-bold text-sm text-white">
              {selectedRun ? `Payslips for ${selectedRun.month}/${selectedRun.year}` : 'Employee Payslips'}
            </h4>
            <span className="text-xs text-slate-400 font-mono">{displayedSlips.length} generated</span>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Gross (1.5x Basic)</th>
                <th className="px-5 py-3.5">Attended / Working</th>
                <th className="px-5 py-3.5">Absence Deduction</th>
                <th className="px-5 py-3.5">Income Tax</th>
                <th className="px-5 py-3.5">Net Pay</th>
                <th className="px-5 py-3.5 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedSlips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No payslips found. Generate a payroll run to compute numbers.
                  </td>
                </tr>
              ) : (
                displayedSlips.map((slip) => {
                  const emp = employees.find(e => e.id === slip.employee_id);
                  return (
                    <tr key={slip.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {emp ? `${emp.first_name} ${emp.last_name}` : slip.employee_id}
                        <span className="block text-[10px] text-slate-500 font-mono">{emp?.emp_code}</span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-white">PKR {Number(slip.gross_salary).toLocaleString()}</td>
                      <td className="px-5 py-3.5">{slip.attended_days} / {slip.working_days} d</td>
                      <td className="px-5 py-3.5 text-rose-400">- PKR {Number(slip.leave_deductions).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-amber-400">- PKR {Number(slip.tax_deduction).toLocaleString()}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">PKR {Number(slip.net_salary).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDownloadPDF(slip)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto border border-slate-700 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
