import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { dataStore } from '../../lib/dataStore';
import { callGroqChat } from '../../lib/groqClient';
import { Bot, Send, Sparkles, X, ShieldAlert, CheckCircle2, User, HelpCircle, Zap } from 'lucide-react';

export default function AIChatDrawer({ isOpen, onClose }) {
  const { currentUser, currentEmployee } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: `Hello! I am your HCM Lite AI Assistant powered by Groq Llama 3.3. Ask me anything about live attendance, headcount, leave balances, or company policies. All answers are strictly scoped to your role and backed by live database records.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  // Process AI query using live database context + Groq Llama 3.3 with strict RBAC guardrails
  const processAIQuery = async (query) => {
    const q = query.toLowerCase().trim();
    const role = currentUser?.role || 'employee';

    // Guardrail: Employee asking for colleague's salary (PDF Module 8 Requirement)
    if (role === 'employee' && (q.includes('salary') || q.includes('pay') || q.includes('compensation') || q.includes('earning')) &&
        !q.includes('my salary') && !q.includes('my payslip') && !q.includes('my pay')) {
      return {
        text: "I cannot disclose colleague salary information. As an employee, you can only view your own compensation and payslips under self-service.",
        toolsUsed: ['scope_guard_denial']
      };
    }

    // Gather Live System State for Context Injection
    const company = await dataStore.getCompany();
    const employees = await dataStore.getEmployees();
    const activeEmployees = employees.filter(e => e.status === 'active' || e.status === 'probation');
    const today = new Date().toISOString().split('T')[0];
    const attendanceToday = await dataStore.getAttendance(today);
    const leaveRequests = await dataStore.getLeaveRequests();

    // Prepare Role-Scoped Context
    let scopedContext = {
      user_role: role,
      user_email: currentUser?.email,
      company_rules: {
        office_start: company?.office_start || '09:00:00',
        grace_minutes: company?.grace_minutes || 15,
        half_day_hours: company?.half_day_hours || 5.0,
        weekend_days: 'Saturday & Sunday',
        leave_quotas: 'Annual: 14 days, Sick: 8 days, Casual: 10 days, Unpaid: Unlimited',
        payroll_formula: 'Gross = 1.5 * Basic (HRA 40%, Medical 10%). Daily rate = Gross / working_days.'
      }
    };

    if (role === 'employee' && currentEmployee) {
      const myBalances = await dataStore.getLeaveBalances(currentEmployee.id);
      const myPayslips = await dataStore.getPayslips();
      const myLatestPayslip = myPayslips.filter(p => p.employee_id === currentEmployee.id).slice(-1)[0];
      const myAtt = attendanceToday.find(a => a.employee_id === currentEmployee.id);

      scopedContext.employee_self = {
        name: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
        emp_code: currentEmployee.emp_code,
        today_attendance: myAtt ? { status: myAtt.status, check_in: myAtt.check_in, check_out: myAtt.check_out } : 'Not checked in today',
        leave_balances: myBalances.map(b => `${b.type}: ${b.quota - b.used} remaining of ${b.quota}`),
        latest_net_pay: myLatestPayslip ? `PKR ${myLatestPayslip.net_salary}` : 'None available'
      };
    }

    if (role === 'admin' || role === 'hr') {
      const presentCount = attendanceToday.filter(a => a.status === 'present' || a.status === 'late').length;
      const lateToday = attendanceToday.filter(a => a.status === 'late');
      const onLeaveToday = leaveRequests.filter(l => l.status === 'approved' && today >= l.start_date && today <= l.end_date);
      const pendingLeaves = leaveRequests.filter(l => l.status === 'pending');

      scopedContext.workforce_live_metrics = {
        active_headcount: activeEmployees.length,
        present_today: presentCount,
        late_today_count: lateToday.length,
        on_leave_today_count: onLeaveToday.length,
        pending_leave_approvals: pendingLeaves.length
      };

      if (role === 'admin') {
        const runs = await dataStore.getPayrollRuns();
        const latestRun = runs[0];
        if (latestRun) {
          scopedContext.payroll_summary = {
            latest_month: `${latestRun.month}/${latestRun.year}`,
            total_gross: latestRun.total_gross,
            total_net: latestRun.total_net,
            status: latestRun.status
          };
        }
      }
    }

    // Call Groq Llama 3.3 with System Prompt and strict RBAC
    const systemPrompt = `You are HCM Lite's intelligent AI Assistant powered by Groq Llama 3.3.
You have access to real-time, ground-truth database records in JSON.
Current User Role: "${role.toUpperCase()}".

STRICT RULES & GUARDRAILS:
1. ONLY answer with information the current role is authorized to see:
   - "employee": Can view company rules, attendance policy, their OWN leave balance, their OWN attendance status, and their OWN payslip. If they ask about colleague salaries or company-wide payroll finances, politely decline citing privacy and RBAC.
   - "hr": Can view company rules, live headcount, daily attendance breakdown, late comers, pending leave requests, but NOT company-wide payroll totals unless public.
   - "admin": Has full access to headcount, attendance analytics, audit trails, and payroll finances.
2. Tone: Professional, crisp, accurate, helpful.
3. Be concise and format key points with bullet points.
4. Always reference the real values provided in the LIVE DATA CONTEXT below.

LIVE DATA CONTEXT:
${JSON.stringify(scopedContext, null, 2)}`;

    try {
      const aiReply = await callGroqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ], { temperature: 0.2 });

      return {
        text: aiReply,
        toolsUsed: ['groq_llama_3.3_70b', 'live_data_retrieval']
      };
    } catch (apiError) {
      console.warn('Groq live call failed, falling back to local deterministic rule engine:', apiError);

      // Local fallback for 100% offline robustness
      if (q.includes('policy') || q.includes('timing') || q.includes('office')) {
        return {
          text: `Company Timing Policies:\n• Office Start: ${company?.office_start || '09:00:00'}\n• Grace Period: ${company?.grace_minutes || 15} minutes\n• Half Day: < ${company?.half_day_hours || 5.0} hrs\n• Weekends: Saturday & Sunday\n• Annual: 14d | Sick: 8d | Casual: 10d.`,
          toolsUsed: ['local_policy_fallback']
        };
      }
      if (q.includes('leave') || q.includes('balance')) {
        if (currentEmployee) {
          const balances = await dataStore.getLeaveBalances(currentEmployee.id);
          const text = balances.map(b => `• ${b.type.toUpperCase()}: ${b.quota - b.used} left of ${b.quota}`).join('\n');
          return { text: `Your Live Leave Balances:\n${text}`, toolsUsed: ['local_leave_fallback'] };
        }
      }
      if (q.includes('headcount') && (role === 'admin' || role === 'hr')) {
        return { text: `Active Organization Headcount: ${activeEmployees.length} members.`, toolsUsed: ['local_headcount_fallback'] };
      }
      return {
        text: `I consulted live records for role ${role.toUpperCase()}. You can ask about company policy, your leave balance, today's attendance, or headcount.`,
        toolsUsed: ['local_assistant_fallback']
      };
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'user', text: userText, timestamp: time }]);
    setLoading(true);

    try {
      const response = await processAIQuery(userText);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: response.text,
          toolsUsed: response.toolsUsed,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: "I encountered an error querying the model. Please check the network or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-purple-600/30">
            <Zap className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Groq AI Assistant
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-semibold">Llama 3.3 70B</span>
            </h3>
            <p className="text-[11px] text-slate-400">Live Scoped Role: <span className="font-semibold text-blue-400 uppercase">{currentUser?.role}</span></p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                m.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20'
                  : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-bl-none shadow'
              }`}
            >
              {m.text}

              {m.sender === 'ai' && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <Sparkles className="w-3 h-3" /> Groq Llama 3.3
                  </span>
                  <span>{m.timestamp}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 w-fit">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Groq Llama 3.3 thinking with live data...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask policy, headcount, leaves, or salary..."
          className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl transition shadow-lg shadow-purple-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
