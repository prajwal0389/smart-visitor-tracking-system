import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import api from '../api';

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    api.get('/dashboardStats').then(r => setStats(r.data));
    api.get('/meetings').then(r => setMeetings(r.data.slice(0, 15)));
  }, []);

  async function override(id, action) {
    await api.post(`/overrideApproval/${id}`, { action });
    setMeetings(m => m.map(x => x.id === id ? { ...x, status: action === 'approve' ? 'accepted' : 'rejected' } : x));
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">HR Dashboard</h2>
        <Link to="/invite" className="btn-primary">+ Invite Visitor</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Visits" value={stats?.today} icon="📅" color="indigo" />
        <StatCard label="Currently Inside" value={stats?.active} icon="🟢" color="green" />
        <StatCard label="Total Meetings" value={stats?.total} icon="📊" color="blue" />
        <StatCard label="Pending Approval" value={stats?.pending} icon="⏳" color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold mb-4">Weekly Visits</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats?.weekly || []}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis /><Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">Pending Approvals</h3>
          <div className="space-y-2 max-h-48 overflow-auto">
            {meetings.filter(m => m.status === 'pending').map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b">
                <div>
                  <p className="font-medium">{m.visitor_name}</p>
                  <p className="text-gray-400 text-xs">{m.host_name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => override(m.id, 'approve')} className="btn-success text-xs py-1 px-2">✓</button>
                  <button onClick={() => override(m.id, 'reject')} className="btn-danger text-xs py-1 px-2">✗</button>
                </div>
              </div>
            ))}
            {meetings.filter(m => m.status === 'pending').length === 0 && <p className="text-gray-400 text-sm">No pending approvals</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">All Meetings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Visitor</th><th className="pb-2">Host</th>
              <th className="pb-2">Scheduled</th><th className="pb-2">Status</th>
            </tr></thead>
            <tbody>
              {meetings.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2">{m.visitor_name}</td>
                  <td className="py-2 text-gray-500">{m.host_name}</td>
                  <td className="py-2 text-gray-500">{new Date(m.scheduled_start).toLocaleString()}</td>
                  <td className="py-2"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
