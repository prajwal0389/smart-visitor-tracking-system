import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import api from '../api';

export default function SecurityDashboard() {
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [msg, setMsg] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(() => {
    api.get('/dashboardStats').then(r => setStats(r.data));
    api.get(`/meetings?date=${today}`).then(r => setMeetings(r.data));
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function handleCheckout(meeting_id, visitor_name) {
    if (!window.confirm(`Check out ${visitor_name}?`)) return;
    try {
      await api.post('/manualCheckout', { meeting_id });
      setMsg(`${visitor_name} checked out successfully`);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Checkout failed');
    }
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Security Dashboard</h2>
        <div className="flex gap-2">
          <Link to="/walkin" className="btn-outline">🚶 Walk-in</Link>
          <Link to="/scanner" className="btn-primary">📷 Open Scanner</Link>
        </div>
      </div>

      {msg && <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg mb-4 text-sm">{msg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Visits" value={stats?.today} icon="📅" color="indigo" />
        <StatCard label="Currently Inside" value={stats?.active} icon="🟢" color="green" />
        <StatCard label="Pending" value={stats?.pending} icon="⏳" color="yellow" />
        <StatCard label="Total" value={stats?.total} icon="📊" color="blue" />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Today's Visitors</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Visitor</th><th className="pb-2">Host</th>
              <th className="pb-2">Scheduled</th><th className="pb-2">Meeting</th><th className="pb-2">Visit</th>
              <th className="pb-2">Action</th>
            </tr></thead>
            <tbody>
              {meetings.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2">
                    <p className="font-medium">{m.visitor_name}</p>
                    <p className="text-gray-400 text-xs">{m.company}</p>
                  </td>
                  <td className="py-2">{m.host_name}</td>
                  <td className="py-2 text-gray-500">{new Date(m.scheduled_start).toLocaleTimeString()}</td>
                  <td className="py-2"><StatusBadge status={m.status} /></td>
                  <td className="py-2"><StatusBadge status={m.log_status || 'pending'} /></td>
                  <td className="py-2">
                    {m.log_status === 'inside' && (
                      <button
                        onClick={() => handleCheckout(m.id, m.visitor_name)}
                        className="btn-danger text-xs py-1 px-2">
                        🚪 Checkout
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {meetings.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No visits today</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
