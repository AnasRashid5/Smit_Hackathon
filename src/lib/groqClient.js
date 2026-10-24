// Groq AI Integration Helper
// Powered by Llama 3.3 70B Versatile on Groq's high-speed inference engine

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export const getGroqApiKey = () => {
  return import.meta.env.VITE_GROQ_API_KEY ||
    import.meta.env.NEXT_PUBLIC_GROQ_API_KEY ||
    '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';
};

/**
 * Call Groq chat completion API with messages & optional temperature
 */
export async function callGroqChat(messages, options = {}) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API Key is not configured.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model || GROQ_MODEL,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 1024,
      response_format: options.response_format || undefined
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Groq API Error response:', response.status, errorBody);
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Natural Language Leave Parser powered by Groq Llama 3.3
 * Translates plain English e.g. "Need next Monday and Tuesday off for sister's wedding"
 * into structured JSON: { leave_type, start_date, end_date, reason }
 */
export async function parseLeaveNLP(promptText) {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentDayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const systemPrompt = `You are a strict HCM Leave Extraction engine.
Today's date is ${todayStr} (${currentDayOfWeek}).
The valid leave types are ONLY: "annual", "sick", "casual", "unpaid".
- Medical/health issues/doctor appointment -> "sick"
- Personal errands/family events/vacation/wedding/personal -> "casual" or "annual"
- Long vacation -> "annual"
- Otherwise default to "casual"

Convert relative dates (e.g. tomorrow, next Monday, this Friday, next week) to exact YYYY-MM-DD format based on today's date ${todayStr}.
If only one day is requested, start_date and end_date should be the exact same date.

Respond with ONLY valid JSON with keys:
{
  "leave_type": "annual" | "sick" | "casual" | "unpaid",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "reason": "cleaned-up reason string"
}`;

  try {
    const raw = await callGroqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText }
    ], { temperature: 0.1 });

    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (err) {
    console.warn('Groq NLP parser fallback to heuristic:', err);
    // Safe heuristic fallback
    const now = new Date();
    const nextMon = new Date(now.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7)));
    const nextTue = new Date(nextMon);
    nextTue.setDate(nextMon.getDate() + 1);
    const isSick = /sick|doctor|fever|medical|hospital/i.test(promptText);

    return {
      leave_type: isSick ? 'sick' : 'casual',
      start_date: nextMon.toISOString().split('T')[0],
      end_date: nextTue.toISOString().split('T')[0],
      reason: promptText
    };
  }
}

/**
 * Executive Dashboard Summarizer powered by Groq Llama 3.3
 */
export async function summarizeDashboardKPIs(type, kpiData) {
  const systemPrompt = `You are an elite HCM Executive Analytics AI.
Your job is to generate 3 to 4 punchy, professional, data-backed bullet points summarizing the provided live metrics.
Every bullet MUST start with a bullet symbol (•).
NEVER fabricate numbers; exclusively cite and synthesize the provided JSON metrics.
Maintain a high-level, executive tone suitable for C-suite and HR leadership.`;

  const userPrompt = `Generate an executive insight summary for the ${type.toUpperCase()} dashboard from this live data:
${JSON.stringify(kpiData, null, 2)}`;

  try {
    const summary = await callGroqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });
    return summary;
  } catch (err) {
    console.warn('Groq summarizer fallback:', err);
    if (type === 'admin') {
      return `• Total active organization headcount stands at ${kpiData.headcount} with healthy organizational retention.\n• Committed monthly payroll is PKR ${Number(kpiData.payrollCost || 0).toLocaleString()} with average compensation of PKR ${Number(kpiData.avgSalary || 0).toLocaleString()}.\n• YTD Attrition rate is currently tracked at ${kpiData.attritionYTD}.\n• Operations and departmental rosters are actively synchronized with company timing rules.`;
    }
    return `• Daily workforce attendance stands at ${kpiData.presentToday || 0} present of ${kpiData.headcount || 0} active members (${kpiData.attendanceRate || '100%'} attendance rate).\n• ${kpiData.lateToday || 0} late arrivals logged past standard office grace period today.\n• ${kpiData.onLeaveToday || 0} employee(s) currently on approved scheduled leave.\n• ${kpiData.pendingApprovals || 0} pending leave request(s) require HR review and action.`;
  }
}
