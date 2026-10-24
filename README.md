# HCM Lite — AI-Assisted Human Capital Management System

> **Saylani Hackathon — Challenge Brief Project**  
> Complete web-based Human Capital Management system built for Admin, HR, and Employees with an integrated AI assistant that answers questions from live system data.

---

## 🚀 Live Demo & Quick Start (< 2 Minutes)

### 1. Requirements
* Node.js (v18+)
* NPM or PNPM

### 2. Run Locally
```bash
# Clone the repository
cd "Hackathon(HCM)"

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## ⚡ First-Run Setup (Starts Completely Empty)

As required by the challenge, **there is zero dummy or pre-loaded data**. 

When launching the app for the very first time:
1. You are automatically routed to `/setup`.
2. Enter your Company Name (e.g. `Saylani Tech Solutions`), timing rules (`09:00:00` start, `15 min` grace period), and Office Geofence coordinates.
3. Create the initial **Admin account** (e.g., `admin@saylanihcm.com` / `Password123!`).
4. Click **Finish Setup & Launch**.

---

## 📋 5-Minute Live Judging Script

1. **First-run install**: Go to `/setup`, create the company profile and Admin login.
2. **Admin creates HR**: Go to **User Access** (`/admin/users`) and create an HR account (`hr@saylanihcm.com` / `Password123!`).
3. **HR logs in & registers Employees**: 
   - Sign in as HR.
   - Go to **Employees** (`/employees`) and register two employees (e.g., `Ali Khan`, `Sara Ahmed` with basic salary `50,000`).
   - The system automatically creates their logins with temporary passwords.
4. **Employee Self-Service**:
   - Sign in as `ali@example.com` with `TempPassword123!`.
   - The app forces a mandatory password change on first sign-in.
   - Click **Web Check-In** (stamps server time; arrival after 09:15 automatically marks as `LATE`).
   - Click **Smart Leave** (M8 NLP): Type *"Need next Monday and Tuesday off for family wedding"*. The system automatically parses the type (`casual`), dates, and reasons into a pre-filled form!
5. **HR Approvals & Payroll**:
   - Sign in as HR. View the live HR Dashboard (updated present, on leave, and attendance rate).
   - Click **Approve** on the employee's pending leave.
   - Click **Summarize Operations** for instant AI insight synthesis.
   - Go to **Payroll** (`/payroll`), select the month, and click **Run Payroll Draft**. The engine calculates Gross (1.5x Basic: HRA 40%, Medical 10%), deductions for unworked days, and tax slabs.
6. **Admin Finalizes & Audit Feed**:
   - Log in as Admin.
   - View Company Dashboard metrics.
   - Go to **Payroll** and click **Finalize & Lock Month**. Finalized runs become permanently locked.
   - Go to **Audit Logs** (`/admin/audit`) to review the complete immutable audit trail with actor, action, and JSON diffs.
7. **Employee Payslip & AI Colleague Guardrail**:
   - Log back in as Employee.
   - Download the official confidential **Payslip PDF**.
   - Open the **AI Assistant (M8)** drawer:
     - Ask: *"What is my leave balance?"* -> Live balance returned.
     - Ask: *"What is Sara's salary?"* -> **Politely refused** due to RBAC guardrail!

---

## 🛡️ Business Rules Implemented (Section 3)

| Module | Business Rule Engine Status |
| :--- | :--- |
| **M1 Auth** | Role-based data scopes (`admin`, `hr`, `employee`). Mandatory temp password reset on first sign-in. |
| **M2 Setup** | Office start 09:00, grace 15 min, half day under 5 hrs, weekends Sat-Sun, office geofence radius. |
| **M3 Employees** | Server-side directory search & filters, CSV import dry-run validation (row + field + reason), CSV export. |
| **M4 Attendance** | 1 check-in per day (second check-in = 409 Conflict), auto-late classification, half-day recalculation. Bonus Camera + Geolocation check-in. |
| **M5 Leave** | Working days only (skips weekends/holidays). Quotas: Annual 14, Sick 8, Casual 10, Unpaid unlimited. Overlap or over-balance = 422. |
| **M6 Payroll** | Gross = 1.5 × basic (HRA 40%, Medical 10%). Daily rate = Gross / working days. Tax slabs: 0-600k (0%), 600k-1.2M (5%), 1.2M-2.4M (15%), 2.4M-3.6M (25%), 3.6M+ (35%). Finalized runs locked. |
| **M7 Dashboards** | All metrics aggregated dynamically from active records without dummy numbers. |
| **M8 AI Assistant** | Tool calling (`get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_my_leave_balance`, `get_payroll_summary`). Smart Leave NLP. Scope guardrails. |
| **M9 Comms & Audit** | Announcements, notifications, and immutable audit logs with before/after state JSON. |

---

## 📦 Tech Stack
* **Frontend**: React 19, Tailwind CSS v4, Lucide Icons, jsPDF.
* **Routing & State**: React Router v7, Context API, Unified Local & Supabase Storage sync.
* **Backend / Database Ready**: Supabase PostgreSQL migration (`supabase/migrations/01_initial_schema.sql`).
