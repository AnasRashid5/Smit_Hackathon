import React, { useState, useEffect } from 'react';
import { dataStore } from '../lib/dataStore';
import DashboardLayout from '../layouts/DashboardLayout';
import { Shield, Clock, FileText } from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const list = await dataStore.getAuditLogs();
    setLogs(list);
  };

  return (
    <DashboardLayout roleTitle="System Audit Trails (M9)">
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Immutable Security Audit Logs</h3>
              <p className="text-[11px] text-slate-400">Captures actor, action, entity, and state changes across the organization</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">{logs.length} events logged</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Entity</th>
                <th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3.5 font-mono text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{log.actor_email}</td>
                  <td className="px-5 py-3.5 uppercase font-mono text-[10px] text-blue-400">{log.actor_role}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 capitalize text-slate-300 font-medium">{log.entity}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded text-xs transition"
                    >
                      JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* JSON Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-white">
                  Audit Snapshot [{selectedLog.action} - {selectedLog.entity}]
                </h4>
                <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white text-xs">
                  Close
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-slate-400 font-semibold mb-1">State Payload (After):</p>
                  <pre className="p-3 bg-slate-950 rounded-xl text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.after_state, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
