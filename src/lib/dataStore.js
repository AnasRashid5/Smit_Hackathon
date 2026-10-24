// Local and Supabase Unified Data Store
// Provides rock-solid storage for live judging, seamlessly synchronizing to Supabase PostgreSQL database

import { supabase, isSupabaseConfigured } from './supabase';
import { calculateHaversineDistance } from './geoUtils';

const STORAGE_KEYS = {
  COMPANY: 'hcm_company_settings',
  USERS: 'hcm_users',
  DEPARTMENTS: 'hcm_departments',
  DESIGNATIONS: 'hcm_designations',
  EMPLOYEES: 'hcm_employees',
  SALARIES: 'hcm_salaries',
  HOLIDAYS: 'hcm_holidays',
  ATTENDANCE: 'hcm_attendance',
  ATTENDANCE_CORRECTIONS: 'hcm_attendance_corrections',
  LEAVE_TYPES: 'hcm_leave_types',
  LEAVE_BALANCES: 'hcm_leave_balances',
  LEAVE_REQUESTS: 'hcm_leave_requests',
  PAYROLL_RUNS: 'hcm_payroll_runs',
  PAYSLIPS: 'hcm_payslips',
  ANNOUNCEMENTS: 'hcm_announcements',
  NOTIFICATIONS: 'hcm_notifications',
  AUDIT_LOGS: 'hcm_audit_logs',
  SESSION: 'hcm_session'
};

const getLocal = (key, defaultVal = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    console.error('Storage read error', key, e);
    return defaultVal;
  }
};

const setLocal = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage write error', key, e);
  }
};

export const dataStore = {
  // --- AUDIT LOGS ---
  async logAudit(actor, action, entity, entityId, beforeState = null, afterState = null) {
    const log = {
      id: crypto.randomUUID(),
      actor_id: actor?.id ? String(actor.id) : null,
      action, // CREATE, UPDATE, APPROVE, REJECT, FINALIZE, DELETE
      entity, // company, employee, attendance, leave, payroll, announcement
      entity_id: String(entityId || ''),
      before_state: beforeState,
      after_state: afterState,
      created_at: new Date().toISOString()
    };
    const logs = getLocal(STORAGE_KEYS.AUDIT_LOGS, []);
    logs.unshift(log);
    setLocal(STORAGE_KEYS.AUDIT_LOGS, logs);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('audit_logs').insert([log]);
      } catch (err) {
        console.warn('Supabase audit sync warning:', err);
      }
    }
    return log;
  },

  async getAuditLogs() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch audit logs error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.AUDIT_LOGS, []);
  },

  // --- COMPANY SETTINGS ---
  async getCompany() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('companies').select('*').limit(1).maybeSingle();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase fetch company error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.COMPANY, null);
  },

  async saveCompany(companyData, actor) {
    const existing = await this.getCompany();
    const payload = {
      id: existing?.id || crypto.randomUUID(),
      name: companyData.name,
      office_start: companyData.office_start || '09:00:00',
      grace_minutes: Number(companyData.grace_minutes) || 15,
      half_day_hours: Number(companyData.half_day_hours) || 5.0,
      weekend_days: companyData.weekend_days || [0, 6], // Sun, Sat
      office_lat: Number(companyData.office_lat) || 24.8607,
      office_lng: Number(companyData.office_lng) || 67.0011,
      radius_meters: Number(companyData.radius_meters) || 150,
      updated_at: new Date().toISOString()
    };
    setLocal(STORAGE_KEYS.COMPANY, payload);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('companies').upsert([payload]);
      } catch (e) {
        console.warn('Supabase upsert company error:', e);
      }
    }
    await this.logAudit(actor, existing ? 'UPDATE' : 'CREATE', 'company', payload.id, existing, payload);
    return payload;
  },

  // --- AUTH & PROFILES ---
  async getUsers() {
    let dbUsers = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data && data.length > 0) {
          // Normalize password field from password_hash or temp_password
          dbUsers = data.map(u => ({
            ...u,
            password: u.password_hash || u.password || u.temp_password || ''
          }));
        }
      } catch (e) {
        console.warn('Supabase fetch profiles error:', e);
      }
    }
    const localUsers = getLocal(STORAGE_KEYS.USERS, []);

    // Merge: if user exists in both, keep the password from local if db is missing it
    const merged = [...dbUsers];
    for (const lu of localUsers) {
      const idx = merged.findIndex(m => m.id === lu.id || m.email.toLowerCase() === lu.email.toLowerCase());
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          password: merged[idx].password || lu.password,
          temp_password: merged[idx].temp_password || lu.temp_password
        };
      } else {
        merged.push(lu);
      }
    }

    if (merged.length > 0) {
      return merged;
    }
    return localUsers;
  },

  async saveUser(user, actor) {
    const users = getLocal(STORAGE_KEYS.USERS, []);
    const existingIndex = users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    let saved;
    if (existingIndex >= 0) {
      const prev = users[existingIndex];
      saved = { ...prev, ...user, updated_at: new Date().toISOString() };
      users[existingIndex] = saved;
      await this.logAudit(actor, 'UPDATE', 'user', saved.id, prev, saved);
    } else {
      saved = {
        id: user.id || crypto.randomUUID(),
        email: user.email.toLowerCase(),
        password: user.password,
        temp_password: user.temp_password || null,
        must_change_password: user.must_change_password ?? false,
        role: user.role, // 'admin', 'hr', 'employee'
        status: user.status || 'active',
        created_at: new Date().toISOString()
      };
      users.push(saved);
      await this.logAudit(actor, 'CREATE', 'user', saved.id, null, saved);
    }
    setLocal(STORAGE_KEYS.USERS, users);

    if (isSupabaseConfigured) {
      try {
        const dbPayload = {
          id: saved.id,
          email: saved.email,
          role: saved.role,
          status: saved.status,
          password_hash: saved.password || saved.temp_password || null,
          temp_password: saved.temp_password,
          must_change_password: saved.must_change_password
        };
        await supabase.from('profiles').upsert([dbPayload]);
      } catch (e) {
        console.warn('Supabase save profile error:', e);
      }
    }
    return saved;
  },

  // --- DEPARTMENTS & DESIGNATIONS ---
  async getDepartments() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('departments').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch departments error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.DEPARTMENTS, []);
  },

  async addDepartment(dept, actor) {
    const list = getLocal(STORAGE_KEYS.DEPARTMENTS, []);
    const item = {
      id: crypto.randomUUID(),
      name: dept.name,
      code: dept.code.toUpperCase(),
      created_at: new Date().toISOString()
    };
    list.push(item);
    setLocal(STORAGE_KEYS.DEPARTMENTS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('departments').insert([item]);
      } catch (e) {
        console.warn('Supabase insert dept error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'department', item.id, null, item);
    return item;
  },

  async getDesignations() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('designations').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch designations error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.DESIGNATIONS, []);
  },

  async addDesignation(desig, actor) {
    const list = getLocal(STORAGE_KEYS.DESIGNATIONS, []);
    const item = {
      id: crypto.randomUUID(),
      title: desig.title,
      department_id: desig.department_id,
      created_at: new Date().toISOString()
    };
    list.push(item);
    setLocal(STORAGE_KEYS.DESIGNATIONS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('designations').insert([item]);
      } catch (e) {
        console.warn('Supabase insert designation error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'designation', item.id, null, item);
    return item;
  },

  // --- EMPLOYEES ---
  async getEmployees() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('employees').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch employees error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.EMPLOYEES, []);
  },

  async saveEmployee(empData, salaryData, actor) {
    const employees = getLocal(STORAGE_KEYS.EMPLOYEES, []);
    const existingIndex = employees.findIndex(e => e.id === empData.id || e.emp_code === empData.emp_code);
    let savedEmp;

    if (existingIndex >= 0) {
      const prev = employees[existingIndex];
      savedEmp = { ...prev, ...empData, updated_at: new Date().toISOString() };
      employees[existingIndex] = savedEmp;
      await this.logAudit(actor, 'UPDATE', 'employee', savedEmp.id, prev, savedEmp);
    } else {
      savedEmp = {
        id: empData.id || crypto.randomUUID(),
        user_id: empData.user_id,
        emp_code: empData.emp_code,
        first_name: empData.first_name,
        last_name: empData.last_name,
        email: empData.email.toLowerCase(),
        phone: empData.phone || '',
        address: empData.address || '',
        department_id: empData.department_id,
        designation_id: empData.designation_id,
        joining_date: empData.joining_date || new Date().toISOString().split('T')[0],
        status: empData.status || 'active',
        gender: empData.gender || 'Not specified',
        created_at: new Date().toISOString()
      };
      employees.push(savedEmp);
      await this.logAudit(actor, 'CREATE', 'employee', savedEmp.id, null, savedEmp);
    }
    setLocal(STORAGE_KEYS.EMPLOYEES, employees);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('employees').upsert([savedEmp]);
      } catch (e) {
        console.warn('Supabase upsert employee error:', e);
      }
    }

    // Save Salary Structure: Gross = 1.5 * Basic (HRA 40%, Medical 10%)
    if (salaryData && salaryData.basic_salary) {
      const basic = Number(salaryData.basic_salary);
      const hra = basic * 0.40;
      const medical = basic * 0.10;
      const gross = basic * 1.50;

      const salaries = getLocal(STORAGE_KEYS.SALARIES, []);
      const salIndex = salaries.findIndex(s => s.employee_id === savedEmp.id);
      const salRecord = {
        id: crypto.randomUUID(),
        employee_id: savedEmp.id,
        basic_salary: basic,
        hra,
        medical,
        gross_salary: gross,
        effective_from: salaryData.effective_from || new Date().toISOString().split('T')[0]
      };
      if (salIndex >= 0) {
        salaries[salIndex] = salRecord;
      } else {
        salaries.push(salRecord);
      }
      setLocal(STORAGE_KEYS.SALARIES, salaries);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('salary_structures').upsert([{
            id: salRecord.id,
            employee_id: salRecord.employee_id,
            basic_salary: salRecord.basic_salary,
            effective_from: salRecord.effective_from
          }]);
        } catch (e) {
          console.warn('Supabase salary insert error:', e);
        }
      }
    }

    // Initialize Leave Balances (Annual 14, Sick 8, Casual 10, Unpaid unlimited)
    const currentYear = new Date().getFullYear();
    const balances = getLocal(STORAGE_KEYS.LEAVE_BALANCES, []);
    const defaultQuotas = [
      { name: 'annual', quota: 14 },
      { name: 'sick', quota: 8 },
      { name: 'casual', quota: 10 },
      { name: 'unpaid', quota: 999 }
    ];
    for (const dq of defaultQuotas) {
      const exists = balances.find(b => b.employee_id === savedEmp.id && b.type === dq.name && b.year === currentYear);
      if (!exists) {
        balances.push({
          id: crypto.randomUUID(),
          employee_id: savedEmp.id,
          type: dq.name,
          year: currentYear,
          quota: dq.quota,
          used: 0
        });
      }
    }
    setLocal(STORAGE_KEYS.LEAVE_BALANCES, balances);

    return savedEmp;
  },

  async getSalaries() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('salary_structures').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch salaries error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.SALARIES, []);
  },

  // --- ATTENDANCE ---
  async getAttendance(filterDate = null) {
    let dbRecords = [];
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('attendance').select('*');
        if (filterDate) query = query.eq('date', filterDate);
        const { data, error } = await query;
        if (!error && data) dbRecords = data;
      } catch (e) {
        console.warn('Supabase fetch attendance error:', e);
      }
    }

    const localList = getLocal(STORAGE_KEYS.ATTENDANCE, []);
    const localFiltered = filterDate ? localList.filter(a => a.date === filterDate) : localList;

    // Merge by unique id or (employee_id + date)
    const merged = [...dbRecords];
    for (const l of localFiltered) {
      const exists = merged.some(m => m.id === l.id || (m.employee_id === l.employee_id && m.date === l.date));
      if (!exists) merged.push(l);
    }

    return merged;
  },

  async checkIn(employeeId, location = null, source = 'web', faceMetrics = null) {
    const today = new Date().toISOString().split('T')[0];
    const records = await this.getAttendance();
    const existing = records.find(r => r.employee_id === employeeId && r.date === today);

    // Business Rule M4: Exactly one record per employee per day; second check-in = 409
    if (existing) {
      const error = new Error('Second check-in attempt. Employee has already checked in today.');
      error.status = 409;
      throw error;
    }

    const company = await this.getCompany() || {
      office_start: '09:00:00',
      grace_minutes: 15,
      office_lat: 24.8607,
      office_lng: 67.0011,
      radius_meters: 150
    };

    // Server-side Geofence & Camera checks (Section 5 Requirement)
    if (source === 'camera' || location) {
      if (faceMetrics && faceMetrics.faceCount !== 1) {
        throw new Error(`Camera attendance rejected: Exactly 1 face must be in frame (found: ${faceMetrics.faceCount}).`);
      }

      if (location && location.lat && location.lng) {
        const distance = calculateHaversineDistance(
          Number(location.lat),
          Number(location.lng),
          Number(company.office_lat || 24.8607),
          Number(company.office_lng || 67.0011)
        );

        if (location.accuracy && location.accuracy > 100) {
          throw new Error(`GPS accuracy too weak (${Math.round(location.accuracy)}m > 100m limit). Please move to an open area.`);
        }

        const maxRadius = Number(company.radius_meters || 150);
        if (distance > maxRadius) {
          throw new Error(`Geofence violation: You are ${distance}m away from the office (Allowed: $\\le$ ${maxRadius}m).`);
        }
      }
    }

    const now = new Date();
    // Rule M4: Late after 09:15 (office_start + grace_minutes)
    const [startH, startM] = (company.office_start || '09:00:00').split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(startH, startM + (company.grace_minutes || 15), 0, 0);

    const isLate = now > deadline;
    const status = isLate ? 'late' : 'present';

    const record = {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      date: today,
      check_in: now.toISOString(),
      check_out: null,
      total_hours: 0,
      status,
      source,
      check_in_lat: location?.lat || null,
      check_in_lng: location?.lng || null
    };

    const localList = getLocal(STORAGE_KEYS.ATTENDANCE, []);
    localList.push(record);
    setLocal(STORAGE_KEYS.ATTENDANCE, localList);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('attendance').insert([record]);
      } catch (e) {
        console.warn('Supabase insert attendance error:', e);
      }
    }
    return record;
  },

  async checkOut(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const records = await this.getAttendance();
    const existing = records.find(r => r.employee_id === employeeId && r.date === today);

    if (!existing) {
      throw new Error('No check-in record found for today. Please check in first.');
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(existing.check_in);
    const diffHours = Math.max(0, (checkOutTime - checkInTime) / (1000 * 60 * 60));

    const company = await this.getCompany() || { half_day_hours: 5.0 };
    let status = existing.status;
    // Rule M4: half_day under 5 hours
    if (diffHours < Number(company.half_day_hours || 5.0)) {
      status = 'half_day';
    }

    const updated = {
      ...existing,
      check_out: checkOutTime.toISOString(),
      total_hours: Number(diffHours.toFixed(2)),
      status
    };

    const localList = getLocal(STORAGE_KEYS.ATTENDANCE, []);
    const localIdx = localList.findIndex(r => r.employee_id === employeeId && r.date === today);
    if (localIdx >= 0) localList[localIdx] = updated;
    else localList.push(updated);
    setLocal(STORAGE_KEYS.ATTENDANCE, localList);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('attendance').update({
          check_out: updated.check_out,
          total_hours: updated.total_hours,
          status: updated.status
        }).eq('id', existing.id);
      } catch (e) {
        console.warn('Supabase update attendance error:', e);
      }
    }
    return updated;
  },

  // --- ATTENDANCE CORRECTIONS ---
  async getCorrections() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('attendance_corrections').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch corrections error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.ATTENDANCE_CORRECTIONS, []);
  },

  async requestCorrection(correctionData, actor) {
    const list = getLocal(STORAGE_KEYS.ATTENDANCE_CORRECTIONS, []);
    const item = {
      id: crypto.randomUUID(),
      employee_id: correctionData.employee_id,
      date: correctionData.date,
      requested_check_in: correctionData.requested_check_in,
      requested_check_out: correctionData.requested_check_out,
      reason: correctionData.reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    list.unshift(item);
    setLocal(STORAGE_KEYS.ATTENDANCE_CORRECTIONS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('attendance_corrections').insert([item]);
      } catch (e) {
        console.warn('Supabase insert correction error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'attendance_correction', item.id, null, item);
    return item;
  },

  async reviewCorrection(id, status, comment, actor) {
    const list = getLocal(STORAGE_KEYS.ATTENDANCE_CORRECTIONS, []);
    const index = list.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Correction not found');

    const item = list[index];
    const prev = { ...item };
    item.status = status; // approved or rejected
    item.review_comment = comment;
    item.reviewed_by = actor.id;
    list[index] = item;
    setLocal(STORAGE_KEYS.ATTENDANCE_CORRECTIONS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('attendance_corrections').update({
          status,
          review_comment: comment,
          reviewed_by: actor.id
        }).eq('id', id);
      } catch (e) {
        console.warn('Supabase update correction error:', e);
      }
    }

    // If approved, update or insert attendance record
    if (status === 'approved') {
      const records = await this.getAttendance();
      const attIndex = records.findIndex(r => r.employee_id === item.employee_id && r.date === item.date);
      const inTime = new Date(item.requested_check_in);
      const outTime = item.requested_check_out ? new Date(item.requested_check_out) : null;
      const hours = outTime ? Math.max(0, (outTime - inTime) / (1000 * 60 * 60)) : 8;

      const updatedRecord = {
        id: attIndex >= 0 ? records[attIndex].id : crypto.randomUUID(),
        employee_id: item.employee_id,
        date: item.date,
        check_in: item.requested_check_in,
        check_out: item.requested_check_out,
        total_hours: Number(hours.toFixed(2)),
        status: hours < 5 ? 'half_day' : 'present',
        source: 'correction'
      };

      const localAtt = getLocal(STORAGE_KEYS.ATTENDANCE, []);
      const lIdx = localAtt.findIndex(r => r.employee_id === item.employee_id && r.date === item.date);
      if (lIdx >= 0) localAtt[lIdx] = updatedRecord;
      else localAtt.push(updatedRecord);
      setLocal(STORAGE_KEYS.ATTENDANCE, localAtt);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('attendance').upsert([updatedRecord]);
        } catch (e) {
          console.warn('Supabase upsert attendance correction record error:', e);
        }
      }
    }

    await this.logAudit(actor, status === 'approved' ? 'APPROVE' : 'REJECT', 'attendance_correction', id, prev, item);
    return item;
  },

  // --- LEAVE MANAGEMENT ---
  async getLeaveBalances(employeeId) {
    const balances = getLocal(STORAGE_KEYS.LEAVE_BALANCES, []);
    return balances.filter(b => b.employee_id === employeeId);
  },

  async getLeaveRequests() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch leave requests error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
  },

  async applyLeave(leaveData, actor) {
    const { employee_id, leave_type, start_date, end_date, reason } = leaveData;
    const requests = await this.getLeaveRequests();
    const balances = await this.getLeaveBalances(employee_id);

    // 1. Calculate working days (skipping weekends & holidays)
    const holidays = getLocal(STORAGE_KEYS.HOLIDAYS, []);    const start = new Date(start_date);
    const end = new Date(end_date);
    let workingDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = day === 0 || day === 6; // Sun or Sat
      const isHoliday = holidays.some(h => h.holiday_date === dateStr);
      if (!isWeekend && !isHoliday) {
        workingDays++;
      }
    }

    if (workingDays <= 0) {
      const err = new Error('Selected range contains only weekends or public holidays.');
      err.status = 422;
      throw err;
    }

    // 2. Overlap check: overlap = 422
    const hasOverlap = requests.some(r => 
      r.employee_id === employee_id &&
      r.status !== 'rejected' &&
      r.status !== 'cancelled' &&
      ((start_date >= r.start_date && start_date <= r.end_date) ||
       (end_date >= r.start_date && end_date <= r.end_date) ||
       (start_date <= r.start_date && end_date >= r.end_date))
    );

    if (hasOverlap) {
      const err = new Error('Leave dates overlap with an existing request.');
      err.status = 422;
      throw err;
    }

    // 3. Balance check: over-balance = 422 (unpaid is unlimited)
    if (leave_type !== 'unpaid') {
      const currentYear = new Date().getFullYear();
      const bal = balances.find(b => b.employee_id === employee_id && b.type === leave_type && b.year === currentYear);
      if (!bal || (bal.quota - bal.used) < workingDays) {
        const available = bal ? bal.quota - bal.used : 0;
        const err = new Error(`Insufficient leave balance. Requested: ${workingDays} days, Available: ${available} days.`);
        err.status = 422;
        throw err;
      }
    }

    const item = {
      id: crypto.randomUUID(),
      employee_id,
      leave_type,
      start_date,
      end_date,
      total_days: workingDays,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const localReqs = getLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
    localReqs.unshift(item);
    setLocal(STORAGE_KEYS.LEAVE_REQUESTS, localReqs);

    if (isSupabaseConfigured) {
      try {
        // Use leave_type as text; if your DB uses a FK, map it separately
        await supabase.from('leave_requests').insert([{
          id: item.id,
          employee_id: item.employee_id,
          leave_type: item.leave_type,
          start_date: item.start_date,
          end_date: item.end_date,
          total_days: item.total_days,
          reason: item.reason,
          status: item.status,
          created_at: item.created_at
        }]);
      } catch (e) {
        console.warn('Supabase insert leave request error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'leave_request', item.id, null, item);
    return item;
  },

  async cancelLeave(id, actor) {
    const localReqs = getLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
    const index = localReqs.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Leave request not found');

    const req = localReqs[index];
    if (req.status !== 'pending') {
      throw new Error('Only pending leave requests can be cancelled.');
    }
    if (req.employee_id !== actor.employee_id && req.employee_id !== actor.id) {
      // Allow cancellation only by the owning employee (or HR/Admin)
      if (actor.role === 'employee') throw new Error('You can only cancel your own leave requests.');
    }

    const prev = { ...req };
    req.status = 'cancelled';
    req.cancelled_at = new Date().toISOString();
    localReqs[index] = req;
    setLocal(STORAGE_KEYS.LEAVE_REQUESTS, localReqs);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('leave_requests').update({ status: 'cancelled', cancelled_at: req.cancelled_at }).eq('id', id);
      } catch (e) {
        console.warn('Supabase cancel leave error:', e);
      }
    }
    await this.logAudit(actor, 'CANCEL', 'leave_request', id, prev, req);
    return req;
  },

  async reviewLeave(id, status, comment, actor) {
    const requests = await this.getLeaveRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Leave request not found');

    const req = requests[index];
    const prev = { ...req };
    req.status = status; // 'approved' or 'rejected'
    req.review_comment = comment;
    req.reviewed_by = actor.id;

    const localReqs = getLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
    const lIdx = localReqs.findIndex(r => r.id === id);
    if (lIdx >= 0) localReqs[lIdx] = req;
    setLocal(STORAGE_KEYS.LEAVE_REQUESTS, localReqs);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('leave_requests').update({
          status,
          review_comment: comment,
          reviewed_by: actor.id
        }).eq('id', id);
      } catch (e) {
        console.warn('Supabase update leave error:', e);
      }
    }

    // If approved, deduct balance
    if (status === 'approved' && req.leave_type !== 'unpaid') {
      const currentYear = new Date(req.start_date).getFullYear();
      const balances = getLocal(STORAGE_KEYS.LEAVE_BALANCES, []);
      const balIndex = balances.findIndex(b => b.employee_id === req.employee_id && b.type === req.leave_type && b.year === currentYear);
      if (balIndex >= 0) {
        balances[balIndex].used += req.total_days;
        setLocal(STORAGE_KEYS.LEAVE_BALANCES, balances);
      }
    }

    await this.logAudit(actor, status === 'approved' ? 'APPROVE' : 'REJECT', 'leave_request', id, prev, req);
    return req;
  },

  // --- PAYROLL ENGINE ---
  calculateTaxAnnual(annualGross) {
    if (annualGross <= 600000) return 0;
    if (annualGross <= 1200000) return (annualGross - 600000) * 0.05;
    if (annualGross <= 2400000) return 30000 + (annualGross - 1200000) * 0.15;
    if (annualGross <= 3600000) return 210000 + (annualGross - 2400000) * 0.25;
    return 510000 + (annualGross - 3600000) * 0.35;
  },

  async getPayrollRuns() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('payroll_runs').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch payroll runs error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.PAYROLL_RUNS, []);
  },

  async getPayslips(payrollRunId = null) {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('payslips').select('*');
        if (payrollRunId) query = query.eq('payroll_run_id', payrollRunId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch payslips error:', e);
      }
    }
    const list = getLocal(STORAGE_KEYS.PAYSLIPS, []);
    if (payrollRunId) return list.filter(p => p.payroll_run_id === payrollRunId);
    return list;
  },

  async createPayrollDraft(month, year, actor) {
    const existingRuns = await this.getPayrollRuns();
    const existing = existingRuns.find(r => r.month === month && r.year === year);
    if (existing && existing.status === 'finalized') {
      throw new Error(`Payroll for ${month}/${year} is finalized and locked.`);
    }

    const employees = (await this.getEmployees()).filter(e => e.status !== 'exited');
    const salaries = await this.getSalaries();
    const attendanceRecords = await this.getAttendance();
    const leaveRequests = await this.getLeaveRequests();

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    let workingDaysInMonth = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        workingDaysInMonth++;
      }
    }
    workingDaysInMonth = Math.max(workingDaysInMonth, 20);

    const runId = existing ? existing.id : crypto.randomUUID();
    let totalGross = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalNet = 0;

    const payslipsList = [];

    for (const emp of employees) {
      const sal = salaries.find(s => s.employee_id === emp.id) || {
        basic_salary: 50000,
        hra: 20000,
        medical: 5000,
        gross_salary: 75000
      };

      const gross = sal.gross_salary;
      const perDayRate = gross / workingDaysInMonth;

      const empAtt = attendanceRecords.filter(a => {
        const d = new Date(a.date);
        return a.employee_id === emp.id && d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      const attended = empAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const halfDays = empAtt.filter(a => a.status === 'half_day').length;

      const empLeaves = leaveRequests.filter(l => {
        const d = new Date(l.start_date);
        return l.employee_id === emp.id && l.status === 'approved' && l.leave_type === 'unpaid' && (d.getMonth() + 1 === month && d.getFullYear() === year);
      });
      const unpaidDays = empLeaves.reduce((acc, curr) => acc + curr.total_days, 0);

      const absentDays = Math.max(0, workingDaysInMonth - attended - halfDays);
      const deductionDays = absentDays + unpaidDays + (0.5 * halfDays);
      const leaveDeduction = Number((deductionDays * perDayRate).toFixed(2));

      const annualTax = this.calculateTaxAnnual(gross * 12);
      const monthlyTax = Number((annualTax / 12).toFixed(2));
      const netSalary = Math.max(0, Number((gross - leaveDeduction - monthlyTax).toFixed(2)));

      totalGross += gross;
      totalDeductions += leaveDeduction;
      totalTax += monthlyTax;
      totalNet += netSalary;

      payslipsList.push({
        id: crypto.randomUUID(),
        payroll_run_id: runId,
        employee_id: emp.id,
        basic_salary: sal.basic_salary,
        hra: sal.hra,
        medical: sal.medical,
        gross_salary: gross,
        working_days: workingDaysInMonth,
        attended_days: attended + (0.5 * halfDays),
        absent_days: absentDays,
        leave_deductions: leaveDeduction,
        tax_deduction: monthlyTax,
        net_salary: netSalary
      });
    }

    const payrollRun = {
      id: runId,
      month,
      year,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_tax: totalTax,
      total_net: totalNet,
      status: 'draft',
      prepared_by: actor?.id || null,
      created_at: new Date().toISOString()
    };

    const updatedRuns = existingRuns.filter(r => r.id !== runId);
    updatedRuns.unshift(payrollRun);
    setLocal(STORAGE_KEYS.PAYROLL_RUNS, updatedRuns);

    const allPayslips = getLocal(STORAGE_KEYS.PAYSLIPS, []).filter(p => p.payroll_run_id !== runId);
    setLocal(STORAGE_KEYS.PAYSLIPS, [...allPayslips, ...payslipsList]);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('payroll_runs').upsert([payrollRun]);
        await supabase.from('payslips').upsert(payslipsList);
      } catch (e) {
        console.warn('Supabase upsert payroll error:', e);
      }
    }

    await this.logAudit(actor, 'CREATE', 'payroll_draft', runId, existing, payrollRun);
    return { run: payrollRun, payslips: payslipsList };
  },

  async finalizePayroll(payrollRunId, actor) {
    const runs = await this.getPayrollRuns();
    const index = runs.findIndex(r => r.id === payrollRunId);
    if (index === -1) throw new Error('Payroll run not found');

    const run = runs[index];
    if (run.status === 'finalized') throw new Error('Payroll run is already finalized and locked.');

    const prev = { ...run };
    run.status = 'finalized';
    run.finalized_by = actor.id;
    run.finalized_at = new Date().toISOString();

    const localRuns = getLocal(STORAGE_KEYS.PAYROLL_RUNS, []);
    const lIdx = localRuns.findIndex(r => r.id === payrollRunId);
    if (lIdx >= 0) localRuns[lIdx] = run;
    setLocal(STORAGE_KEYS.PAYROLL_RUNS, localRuns);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('payroll_runs').update({
          status: 'finalized',
          finalized_by: actor.id,
          finalized_at: run.finalized_at
        }).eq('id', payrollRunId);
      } catch (e) {
        console.warn('Supabase update payroll finalized error:', e);
      }
    }

    await this.logAudit(actor, 'FINALIZE', 'payroll_run', payrollRunId, prev, run);
    return run;
  },

  // --- HOLIDAYS ---
  async getHolidays() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('public_holidays').select('*').order('holiday_date', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch holidays error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.HOLIDAYS, []);
  },

  async addHoliday(holidayData, actor) {
    const list = getLocal(STORAGE_KEYS.HOLIDAYS, []);
    const existing = list.find(h => h.holiday_date === holidayData.holiday_date);
    if (existing) throw new Error('A holiday on this date already exists.');

    const item = {
      id: crypto.randomUUID(),
      holiday_date: holidayData.holiday_date,
      name: holidayData.name,
      created_at: new Date().toISOString()
    };
    list.push(item);
    list.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    setLocal(STORAGE_KEYS.HOLIDAYS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('public_holidays').insert([item]);
      } catch (e) {
        console.warn('Supabase insert holiday error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'holiday', item.id, null, item);
    return item;
  },

  async deleteHoliday(id, actor) {
    const list = getLocal(STORAGE_KEYS.HOLIDAYS, []);
    const index = list.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Holiday not found');
    const prev = list[index];
    list.splice(index, 1);
    setLocal(STORAGE_KEYS.HOLIDAYS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('public_holidays').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase delete holiday error:', e);
      }
    }
    await this.logAudit(actor, 'DELETE', 'holiday', id, prev, null);
  },

  // --- ANNOUNCEMENTS ---
  async getAnnouncements() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch announcements error:', e);
      }
    }
    return getLocal(STORAGE_KEYS.ANNOUNCEMENTS, []);
  },

  async postAnnouncement(announcementData, actor) {
    const list = getLocal(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const item = {
      id: crypto.randomUUID(),
      title: announcementData.title,
      content: announcementData.content,
      priority: announcementData.priority || 'normal',
      author_id: actor?.id ? String(actor.id) : null,
      created_at: new Date().toISOString()
    };
    list.unshift(item);
    setLocal(STORAGE_KEYS.ANNOUNCEMENTS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('announcements').insert([item]);
      } catch (e) {
        console.warn('Supabase insert announcement error:', e);
      }
    }
    await this.logAudit(actor, 'CREATE', 'announcement', item.id, null, item);
    return item;
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase fetch notifications error:', e);
      }
    }
    const list = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
    return list.filter(n => n.user_id === userId);
  },

  async addNotification(userId, title, message, type = 'info') {
    const list = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
    const item = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    };
    list.unshift(item);
    setLocal(STORAGE_KEYS.NOTIFICATIONS, list);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').insert([item]);
      } catch (e) {
        console.warn('Supabase insert notification error:', e);
      }
    }
    return item;
  }
};
