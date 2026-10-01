import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api';

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await api.get(`/attendance?date=${date}`);
    setRecords(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date]);

  async function markAction(meeting_id, action) {
    try {
      await api.post('/attendance/mark', { meeting_id, action });
      setMsg(`${action === 'entry' ? 'Entry' : 'Exit'} marked`);
      await load();
    } catch (e) { setMsg(e.response?.data?.error || 'Error'); }
    setTimeout(() => setMsg(''), 3000);
  }

  async function resendMail(meeting_id) {
    try {
      await api.post('/attendance/resend-exit-mail', { meeting_id });
      setMsg('Exit mail resent');
      await load();
    } catch (e) { setMsg(e.response?.data?.error || 'Error'); }
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Attendance</h2>
        <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      {msg && <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg mb-4 text-sm">{msg}</div>}
      <div className="card">
        {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Visitor</th>
                  <th className="pb-2">Host</th>
                  <th className="pb-2">Scheduled</th>
                  <th className="pb-2">Meeting</th>
                  <th className="pb-2">Visit</th>
                  <th className="pb-2">Entry</th>
                  <th className="pb-2">Exit</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2">
                      <p className="font-medium">{r.visitor_name}</p>
                      <p className="text-gray-400 text-xs">{r.company}</p>
                    </td>
                    <td className="py-2">{r.host_name}</td>
                    <td className="py-2 text-gray-500">{new Date(r.scheduled_start).toLocaleTimeString()}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                    <td className="py-2"><StatusBadge status={r.log_status || 'pending'} /></td>
                    <td className="py-2 text-gray-500 text-xs">{r.entry_time ? new Date(r.entry_time).toLocaleTimeString() : '—'}</td>
                    <td className="py-2 text-gray-500 text-xs">{r.exit_time ? new Date(r.exit_time).toLocaleTimeString() : '—'}</td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        {r.log_status !== 'inside' && r.log_status !== 'exited' && r.status === 'accepted' && (
                          <button onClick={() => markAction(r.id, 'entry')} className="btn-success text-xs py-1 px-2">Entry</button>
                        )}
                        {r.log_status === 'inside' && (
                          <button onClick={() => markAction(r.id, 'exit')} className="btn-danger text-xs py-1 px-2">Exit</button>
                        )}
                        {r.log_status === 'exited' && (
                          <button onClick={() => resendMail(r.id)} className="btn-outline text-xs py-1 px-2">Resend Mail</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">No records for this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
