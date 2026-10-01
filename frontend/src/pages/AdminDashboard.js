import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import api from '../api';

const EMPTY_USER = { name: '', email: '', password: '', role: 'host' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [userMsg, setUserMsg] = useState('');
  const [userErr, setUserErr] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    api.get('/dashboardStats').then(r => setStats(r.data));
    api.get('/meetings').then(r => setMeetings(r.data.slice(0, 10)));
    api.get('/visitors').then(r => setVisitors(r.data));
    api.get('/users').then(r => setUsers(r.data));
  }, []);

  async function handleBlacklist(id, reason) {
    await api.post(`/blacklist/${id}`, { reason });
    setVisitors(v => v.map(x => x.id === id ? { ...x, is_blacklisted: true } : x));
  }

  async function handleUnblacklist(id) {
    await api.delete(`/blacklist/${id}`);
    setVisitors(v => v.map(x => x.id === id ? { ...x, is_blacklisted: false } : x));
  }

  async function override(id, action) {
    await api.post(`/overrideApproval/${id}`, { action });
    setMeetings(m => m.map(x => x.id === id ? { ...x, status: action === 'approve' ? 'accepted' : 'rejected' } : x));
  }

  async function handleAddUser(e) {
    e.preventDefault();
    setUserErr(''); setUserMsg('');
    try {
      const { data } = await api.post('/auth/register', userForm);
      setUsers(u => [...u, data]);
      setUserMsg(`${data.name} (${data.role}) added successfully!`);
      setUserForm(EMPTY_USER);
      setShowAddUser(false);
    } catch (err) {
      setUserErr(err.response?.data?.error || 'Failed to add user');
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.weekly || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Pending Approvals</h3>
          <div className="space-y-2 max-h-48 overflow-auto">
            {meetings.filter(m => m.status === 'pending').map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                <div>
                  <p className="font-medium">{m.visitor_name}</p>
                  <p className="text-gray-400 text-xs">{m.host_name} · {new Date(m.scheduled_start).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => override(m.id, 'approve')} className="btn-success text-xs py-1 px-2">✓ Approve</button>
                  <button onClick={() => override(m.id, 'reject')} className="btn-danger text-xs py-1 px-2">✗ Reject</button>
                </div>
              </div>
            ))}
            {meetings.filter(m => m.status === 'pending').length === 0 && <p className="text-gray-400 text-sm text-center py-4">No pending approvals</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Recent Meetings</h3>
          <div className="space-y-2 max-h-48 overflow-auto">
            {meetings.map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                <div>
                  <p className="font-medium">{m.visitor_name}</p>
                  <p className="text-gray-400 text-xs">{m.host_name} · {new Date(m.scheduled_start).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">User Management</h3>
          <button onClick={() => { setShowAddUser(s => !s); setUserErr(''); setUserMsg(''); }} className="btn-primary text-sm">
            {showAddUser ? 'Cancel' : '+ Add User'}
          </button>
        </div>
        {userMsg && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{userMsg}</div>}
        {userErr && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{userErr}</div>}
        {showAddUser && (
          <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3 mb-4 p-4 bg-gray-50 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input className="input" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input className="input" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <input className="input" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                <option value="host">Host</option>
                <option value="hr_admin">HR Admin</option>
                <option value="security">Security</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" className="btn-primary w-full">Create User</button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Joined</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium">{u.name}</td>
                  <td className="py-2 text-gray-500">{u.email}</td>
                  <td className="py-2"><span className="badge-blue badge">{u.role}</span></td>
                  <td className="py-2 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No users yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Visitor Management & Blacklist</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Name</th><th className="pb-2">Email</th>
              <th className="pb-2">Company</th><th className="pb-2">Status</th><th className="pb-2">Action</th>
            </tr></thead>
            <tbody>
              {visitors.map(v => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2">{v.name}</td>
                  <td className="py-2 text-gray-500">{v.email}</td>
                  <td className="py-2">{v.company}</td>
                  <td className="py-2">
                    {v.is_blacklisted ? <span className="badge-red">Blacklisted</span> : <span className="badge-green">Active</span>}
                  </td>
                  <td className="py-2">
                    {v.is_blacklisted
                      ? <button onClick={() => handleUnblacklist(v.id)} className="text-green-600 hover:underline text-xs">Remove</button>
                      : <button onClick={() => { const r = prompt('Reason?'); if (r) handleBlacklist(v.id, r); }} className="text-red-600 hover:underline text-xs">Blacklist</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
