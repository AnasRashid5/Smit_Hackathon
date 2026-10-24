import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { dataStore } from '../lib/dataStore';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  Users, UserPlus, Search, Download, Upload,
  AlertCircle, CheckCircle, X, Edit3, UserCheck, UserX
} from 'lucide-react';

export default function EmployeesPage() {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [dryRunReport, setDryRunReport] = useState([]);
  const [dryRunValid, setDryRunValid] = useState([]);
  const [selectedProfile360, setSelectedProfile360] = useState(null);
  const [editEmp, setEditEmp] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const emptyForm = {
    first_name: '', last_name: '', email: '', phone: '', address: '',
    emp_code: '', department_id: '', designation_id: '',
    basic_salary: 50000, temp_password: 'TempPassword123!',
    joining_date: new Date().toISOString().split('T')[0]
  };
  const [newEmp, setNewEmp] = useState(emptyForm);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const emps = await dataStore.getEmployees();
      const depts = await dataStore.getDepartments();
      const desigs = await dataStore.getDesignations();
      const sals = await dataStore.getSalaries();
      setEmployees(emps);
      setDepartments(depts);
      setDesignations(desigs);
      setSalaries(sals);

      if (depts.length > 0) {
        setNewEmp(prev => ({
          ...prev,
          department_id: prev.department_id || depts[0].id,
          emp_code: prev.emp_code || `EMP-${String(101 + emps.length).padStart(3, '0')}`
        }));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load employee data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Duplicate email check (client-side guard before hitting DB)
    const isDuplicate = employees.some(em =>
      em.email.toLowerCase() === newEmp.email.toLowerCase() && em.id !== editEmp?.id
    );
    if (isDuplicate) {
      setErrorMsg('An employee with this email already exists.');
      return;
    }

    // Duplicate emp_code check
    const isDupCode = employees.some(em =>
      em.emp_code === newEmp.emp_code && em.id !== editEmp?.id
    );
    if (isDupCode) {
      setErrorMsg('Employee code already in use. Please choose a unique code.');
      return;
    }

    if (Number(newEmp.basic_salary) <= 0) {
      setErrorMsg('Basic salary must be greater than 0.');
      return;
    }

    try {
      if (editEmp) {
        // UPDATE existing employee (phone & address editable by all; all fields by HR)
        await dataStore.saveEmployee({
          ...editEmp,
          first_name: newEmp.first_name,
          last_name: newEmp.last_name,
          phone: newEmp.phone,
          address: newEmp.address,
          department_id: newEmp.department_id,
          designation_id: newEmp.designation_id || null,
          joining_date: newEmp.joining_date
        }, { basic_salary: Number(newEmp.basic_salary) }, currentUser);
        setSuccessMsg(`${newEmp.first_name} ${newEmp.last_name}'s profile updated.`);
      } else {
        // CREATE new employee + auto-generate login
        const user = await dataStore.saveUser({
          email: newEmp.email,
          temp_password: newEmp.temp_password,
          role: 'employee',
          status: 'active',
          must_change_password: true
        }, currentUser);

        await dataStore.saveEmployee({
          user_id: user.id,
          emp_code: newEmp.emp_code,
          first_name: newEmp.first_name,
          last_name: newEmp.last_name,
          email: newEmp.email,
          phone: newEmp.phone,
          address: newEmp.address,
          department_id: newEmp.department_id,
          designation_id: newEmp.designation_id || (designations[0]?.id || null),
          joining_date: newEmp.joining_date,
          status: 'active'
        }, { basic_salary: Number(newEmp.basic_salary) }, currentUser);

        setSuccessMsg(
          `✅ ${newEmp.first_name} registered! Login: ${newEmp.email} | Temp Password: ${newEmp.temp_password}`
        );
      }
      setShowAddModal(false);
      setEditEmp(null);
      setNewEmp(emptyForm);
      await loadAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save employee');
    }
  };

  const openEditModal = (emp) => {
    const sal = salaries.find(s => s.employee_id === emp.id);
    setEditEmp(emp);
    setNewEmp({
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      address: emp.address || '',
      emp_code: emp.emp_code,
      department_id: emp.department_id || '',
      designation_id: emp.designation_id || '',
      basic_salary: sal?.basic_salary || 50000,
      temp_password: '',
      joining_date: emp.joining_date || ''
    });
    setShowAddModal(true);
  };

  const handleDeactivateEmployee = async (emp) => {
    const newStatus = emp.status === 'active' ? 'exited' : 'active';
    await dataStore.saveEmployee({ ...emp, status: newStatus }, null, currentUser);
    setSuccessMsg(`${emp.first_name} ${emp.last_name} marked as ${newStatus}.`);
    await loadAll();
  };

  // CSV Dry-Run Validation (M3: returns [ { row, field, reason } ])
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset file input so same file can be re-uploaded
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMsg('CSV file has no data rows.');
        return;
      }

      const report = [];
      const validRows = [];
      const seenEmails = new Set();
      const seenCodes = new Set();

      // Expected format: emp_code, first_name, last_name, email, department_code, basic_salary
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const rowNum = i + 1;
        const [code, firstName, lastName, email, deptCode, salaryRaw] = cols;
        const salary = Number(salaryRaw);

        // Required fields
        if (!code || !firstName || !email) {
          report.push({ row: rowNum, field: 'required_fields', reason: 'Missing emp_code, first_name, or email' });
          continue;
        }

        // Email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          report.push({ row: rowNum, field: 'email', reason: `Invalid email format: "${email}"` });
          continue;
        }

        // Unique email within CSV
        if (seenEmails.has(email.toLowerCase())) {
          report.push({ row: rowNum, field: 'email', reason: `Duplicate email in CSV: "${email}"` });
          continue;
        }

        // Unique email in existing employees
        if (employees.some(em => em.email.toLowerCase() === email.toLowerCase())) {
          report.push({ row: rowNum, field: 'email', reason: `Email already registered: "${email}"` });
          continue;
        }

        // Unique code within CSV
        if (seenCodes.has(code)) {
          report.push({ row: rowNum, field: 'emp_code', reason: `Duplicate code in CSV: "${code}"` });
          continue;
        }

        // Unique code in existing employees
        if (employees.some(em => em.emp_code === code)) {
          report.push({ row: rowNum, field: 'emp_code', reason: `Employee code already used: "${code}"` });
          continue;
        }

        // Department must exist
        const dept = departments.find(
          d => d.code === deptCode?.toUpperCase() || d.name.toLowerCase() === deptCode?.toLowerCase()
        );
        if (!dept) {
          report.push({ row: rowNum, field: 'department', reason: `Unknown department: "${deptCode}". Valid codes: ${departments.map(d => d.code).join(', ')}` });
          continue;
        }

        // Salary > 0
        if (isNaN(salary) || salary <= 0) {
          report.push({ row: rowNum, field: 'basic_salary', reason: `Salary must be a positive number, got: "${salaryRaw}"` });
          continue;
        }

        seenEmails.add(email.toLowerCase());
        seenCodes.add(code);
        validRows.push({ code, firstName, lastName: lastName || '', email, dept, salary });
      }

      setDryRunReport(report);
      setDryRunValid(validRows);
      setShowDryRunModal(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    try {
      for (const row of dryRunValid) {
        const u = await dataStore.saveUser({
          email: row.email,
          temp_password: 'TempPassword123!',
          role: 'employee',
          must_change_password: true
        }, currentUser);

        await dataStore.saveEmployee({
          user_id: u.id,
          emp_code: row.code,
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email,
          department_id: row.dept.id,
          designation_id: designations[0]?.id || null,
          joining_date: new Date().toISOString().split('T')[0],
          status: 'active'
        }, { basic_salary: row.salary }, currentUser);
      }
      setSuccessMsg(`✅ ${dryRunValid.length} employee(s) imported successfully!`);
      setShowDryRunModal(false);
      await loadAll();
    } catch (err) {
      setErrorMsg(err.message || 'Import failed');
    }
  };

  const handleExportCSV = () => {
    const headers = 'emp_code,first_name,last_name,email,department,designation,joining_date,status,gross_salary\n';
    const rows = employees.map(e => {
      const d = departments.find(dep => dep.id === e.department_id)?.name || 'General';
      const des = designations.find(des => des.id === e.designation_id)?.title || '';
      const sal = salaries.find(s => s.employee_id === e.id);
      return `${e.emp_code},${e.first_name},${e.last_name},${e.email},${d},${des},${e.joining_date},${e.status},${sal?.gross_salary || 0}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Employees_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = employees.filter(e => {
    const matchSearch = `${e.first_name} ${e.last_name} ${e.email} ${e.emp_code}`
      .toLowerCase().includes(search.toLowerCase());
    const matchDept = !selectedDept || e.department_id === selectedDept;
    const matchStatus = !selectedStatus || e.status === selectedStatus;
    return matchSearch && matchDept && matchStatus;
  });

  return (
    <DashboardLayout roleTitle="Employee 360 & Directory">
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="ml-auto"><X className="w-3 h-3" /></button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="ml-auto"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, or email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="">All Depts</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="exited">Exited</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role !== 'employee' && (
              <>
                <label className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>CSV Import</span>
                  <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                </label>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Export</span>
                </button>

                <button
                  onClick={() => { setEditEmp(null); setNewEmp(emptyForm); setShowAddModal(true); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Register Employee
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Total: <strong className="text-white">{employees.length}</strong></span>
          <span>Active: <strong className="text-emerald-400">{employees.filter(e => e.status === 'active' || e.status === 'probation').length}</strong></span>
          <span>Exited: <strong className="text-rose-400">{employees.filter(e => e.status === 'exited').length}</strong></span>
          <span>Showing: <strong className="text-blue-400">{filtered.length}</strong></span>
        </div>

        {/* Employee Directory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Gross Salary</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">No employees match criteria.</td></tr>
                ) : (
                  filtered.map((emp) => {
                    const dept = departments.find(d => d.id === emp.department_id);
                    const sal = salaries.find(s => s.employee_id === emp.id);
                    return (
                      <tr key={emp.id} className={`hover:bg-slate-800/40 transition ${emp.status === 'exited' ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5 font-mono text-blue-400">{emp.emp_code}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">
                          <div>{emp.first_name} {emp.last_name}</div>
                          <span className="text-[10px] text-slate-500 font-normal">{emp.email}</span>
                        </td>
                        <td className="px-5 py-3.5">{dept?.name || 'General'}</td>
                        <td className="px-5 py-3.5 text-emerald-400 font-medium">
                          {sal ? `PKR ${Number(sal.gross_salary).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px]">{emp.joining_date || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            emp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            emp.status === 'probation' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedProfile360(emp)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs border border-slate-700 transition"
                            >
                              View 360
                            </button>
                            {currentUser?.role !== 'employee' && (
                              <button
                                onClick={() => openEditModal(emp)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
                                title="Edit Employee"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {currentUser?.role === 'admin' && (
                              <button
                                onClick={() => handleDeactivateEmployee(emp)}
                                className={`p-1.5 rounded-lg border transition ${
                                  emp.status === 'exited'
                                    ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                                    : 'bg-rose-600/20 border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white'
                                }`}
                                title={emp.status === 'exited' ? 'Re-Activate' : 'Mark Exited'}
                              >
                                {emp.status === 'exited' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 360 Profile Modal */}
        {selectedProfile360 && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-white text-base">Employee 360° Profile</h3>
                  <p className="text-xs text-blue-400 font-mono">{selectedProfile360.emp_code}</p>
                </div>
                <button onClick={() => setSelectedProfile360(null)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const sal = salaries.find(s => s.employee_id === selectedProfile360.id);
                const dept = departments.find(d => d.id === selectedProfile360.department_id);
                const desig = designations.find(d => d.id === selectedProfile360.designation_id);
                return (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-800/60 rounded-xl space-y-2">
                      <p><strong className="text-slate-400">Full Name:</strong> <span className="text-white">{selectedProfile360.first_name} {selectedProfile360.last_name}</span></p>
                      <p><strong className="text-slate-400">Email:</strong> <span className="text-white">{selectedProfile360.email}</span></p>
                      <p><strong className="text-slate-400">Phone:</strong> <span className="text-white">{selectedProfile360.phone || '—'}</span></p>
                      <p><strong className="text-slate-400">Address:</strong> <span className="text-white">{selectedProfile360.address || '—'}</span></p>
                      <p><strong className="text-slate-400">Gender:</strong> <span className="text-white">{selectedProfile360.gender || '—'}</span></p>
                    </div>
                    <div className="p-3 bg-slate-800/60 rounded-xl space-y-2">
                      <p><strong className="text-slate-400">Department:</strong> <span className="text-white">{dept?.name || 'General'}</span></p>
                      <p><strong className="text-slate-400">Designation:</strong> <span className="text-white">{desig?.title || '—'}</span></p>
                      <p><strong className="text-slate-400">Joining Date:</strong> <span className="text-white">{selectedProfile360.joining_date || '—'}</span></p>
                      <p><strong className="text-slate-400">Status:</strong> <span className="text-emerald-400 uppercase font-bold">{selectedProfile360.status}</span></p>
                    </div>
                    {/* HR/Admin see salary in 360 view; Employee cannot see colleagues' data */}
                    {currentUser?.role !== 'employee' && sal && (
                      <div className="p-3 bg-slate-800/60 rounded-xl space-y-2">
                        <p className="text-slate-400 font-semibold uppercase text-[10px]">Salary Structure (M6)</p>
                        <p><strong className="text-slate-400">Basic:</strong> <span className="text-white">PKR {Number(sal.basic_salary).toLocaleString()}</span></p>
                        <p><strong className="text-slate-400">HRA (40%):</strong> <span className="text-white">PKR {Number(sal.hra).toLocaleString()}</span></p>
                        <p><strong className="text-slate-400">Medical (10%):</strong> <span className="text-white">PKR {Number(sal.medical).toLocaleString()}</span></p>
                        <p><strong className="text-slate-400">Gross (1.5x):</strong> <span className="text-emerald-400 font-bold">PKR {Number(sal.gross_salary).toLocaleString()}</span></p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* CSV Dry-Run Report Modal — shows errors AND allows confirming if all pass */}
        {showDryRunModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">CSV Import Dry-Run Report</h3>
                  <p className="text-xs text-slate-400">Validation before committing to database</p>
                </div>
                <button onClick={() => setShowDryRunModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {dryRunReport.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <p className="text-xs text-rose-400 font-semibold">❌ {dryRunReport.length} validation error(s) found. Fix CSV and re-upload:</p>
                  {dryRunReport.map((err, idx) => (
                    <div key={idx} className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs">
                      <strong>Row {err.row}</strong> [{err.field}]: {err.reason}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Dry-run passed! {dryRunValid.length} valid record(s) ready to import.</span>
                  </div>
                  <button
                    onClick={handleConfirmImport}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
                  >
                    Confirm & Import {dryRunValid.length} Employee(s)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add / Edit Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-white text-base">
                  {editEmp ? `Edit Employee — ${editEmp.first_name}` : 'Register New Employee (Auto-Creates Login)'}
                </h3>
                <button onClick={() => { setShowAddModal(false); setEditEmp(null); }} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">First Name *</label>
                    <input
                      type="text" required value={newEmp.first_name}
                      onChange={(e) => setNewEmp(p => ({ ...p, first_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Last Name *</label>
                    <input
                      type="text" required value={newEmp.last_name}
                      onChange={(e) => setNewEmp(p => ({ ...p, last_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email *</label>
                    <input
                      type="email" required value={newEmp.email}
                      disabled={!!editEmp}
                      onChange={(e) => setNewEmp(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Employee Code *</label>
                    <input
                      type="text" required value={newEmp.emp_code}
                      disabled={!!editEmp}
                      onChange={(e) => setNewEmp(p => ({ ...p, emp_code: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone</label>
                    <input
                      type="tel" value={newEmp.phone}
                      onChange={(e) => setNewEmp(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Joining Date</label>
                    <input
                      type="date" value={newEmp.joining_date}
                      onChange={(e) => setNewEmp(p => ({ ...p, joining_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Address</label>
                  <input
                    type="text" value={newEmp.address}
                    onChange={(e) => setNewEmp(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Department *</label>
                    <select
                      value={newEmp.department_id}
                      onChange={(e) => setNewEmp(p => ({ ...p, department_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    >
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Designation</label>
                    <select
                      value={newEmp.designation_id}
                      onChange={(e) => setNewEmp(p => ({ ...p, designation_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    >
                      <option value="">— Select Designation —</option>
                      {designations
                        .filter(d => !newEmp.department_id || d.department_id === newEmp.department_id)
                        .map(d => <option key={d.id} value={d.id}>{d.title}</option>)
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Basic Salary (PKR) *</label>
                  <input
                    type="number" required min={1}
                    value={newEmp.basic_salary}
                    onChange={(e) => setNewEmp(p => ({ ...p, basic_salary: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                {/* Live salary preview */}
                {newEmp.basic_salary > 0 && (
                  <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Salary Preview (M6 Rule)</span>
                    <div className="grid grid-cols-4 gap-2 mt-1 text-center">
                      <div><p className="text-slate-400">Basic</p><p className="font-bold text-white">PKR {Number(newEmp.basic_salary).toLocaleString()}</p></div>
                      <div><p className="text-slate-400">HRA 40%</p><p className="font-bold text-white">PKR {(newEmp.basic_salary * 0.4).toLocaleString()}</p></div>
                      <div><p className="text-slate-400">Medical 10%</p><p className="font-bold text-white">PKR {(newEmp.basic_salary * 0.1).toLocaleString()}</p></div>
                      <div><p className="text-slate-400">Gross 1.5x</p><p className="font-bold text-emerald-400">PKR {(newEmp.basic_salary * 1.5).toLocaleString()}</p></div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
                >
                  {editEmp ? 'Update Employee' : 'Register & Generate Temp Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
