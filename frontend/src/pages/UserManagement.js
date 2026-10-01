import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../AuthContext';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'host' };

export default function UserManagement() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data));
    if (isAdmin) api.get('/auth/user-requests').then(r => setRequests(r.data));
  }, [isAdmin]);

  function flash(m, isErr = false) {
    isErr ? setErr(m) : setMsg(m);
    setTimeout(() => { setMsg(''); setErr(''); }, 4000);
  }

  function startEdit(u) {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowForm(true);
  }

  function cancelForm() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setErr('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      if (isAdmin) {
        if (editingUser) {
          const { data } = await api.put(`/auth/users/${editingUser.id}`, form);
          setUsers(u => u.map(x => x.id === editingUser.id ? data : x));
          flash(`${data.name} updated successfully`);
        } else {
          const { data } = await api.post('/auth/register', form);
          setUsers(u => [...u, data]);
          flash(`${data.name} (${data.role}) added successfully`);
        }
      } else {
        await api.post('/auth/user-requests', {
          action: editingUser ? 'edit' : 'add',
          target_user_id: editingUser?.id || null,
          payload: form
        });
        flash('Request submitted — awaiting admin approval');
      }
      cancelForm();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try {
      if (isAdmin) {
        await api.delete(`/auth/users/${u.id}`);
        setUsers(us => us.filter(x => x.id !== u.id));
        flash(`${u.name} deleted`);
      } else {
        await api.post('/auth/user-requests', {
          action: 'delete',
          target_user_id: u.id,
          payload: { name: u.name, email: u.email, role: u.role }
        });
        flash('Delete request submitted — awaiting admin approval');
      }
    } catch (e) {
      flash(e.response?.data?.error || 'Failed', true);
    }
  }

  async function reviewRequest(id, decision) {
    try {
      await api.post(`/auth/user-requests/${id}/review`, { decision });
      setRequests(r => r.filter(x => x.id !== id));
      if (decision === 'approved') api.get('/users').then(r => setUsers(r.data));
      flash(`Request ${decision}`);
    } catch (e) {
      flash(e.response?.data?.error || 'Failed', true);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button onClick={() => { cancelForm(); setShowForm(s => !s); }} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {msg && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{err}</div>}

      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg mb-4 text-sm">
          ⚠️ As HR Admin, your add/edit/delete requests will be sent to admin for approval.
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4">{editingUser ? `Edit — ${editingUser.name}` : 'Add New User'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editingUser} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="host">Host</option>
                <option value="hr_admin">HR Admin</option>
                <option value="security">Security</option>
                {isAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="btn-primary">
                {isAdmin ? (editingUser ? 'Save Changes' : 'Create User') : 'Submit for Approval'}
              </button>
              <button type="button" onClick={cancelForm} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && requests.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4">⏳ Pending HR Requests ({requests.length})</h3>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <div>
                  <p className="font-medium text-sm">
                    <span className={`badge mr-2 ${r.action === 'add' ? 'badge-green' : r.action === 'edit' ? 'badge-blue' : 'badge-red'}`}>
                      {r.action.toUpperCase()}
                    </span>
                    {r.payload.name} ({r.payload.role})
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requested by {r.requested_by_name} · {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.action === 'delete' && <p className="text-xs text-red-500 mt-0.5">Will permanently delete this user</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewRequest(r.id, 'approved')} className="btn-success text-xs py-1 px-3">✓ Approve</button>
                  <button onClick={() => reviewRequest(r.id, 'rejected')} className="btn-danger text-xs py-1 px-3">✗ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-4">All Users ({users.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium">{u.name}</td>
                  <td className="py-2 text-gray-500">{u.email}</td>
                  <td className="py-2"><span className="badge badge-blue">{u.role}</span></td>
                  <td className="py-2 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(u)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(u)} className="text-red-500 hover:underline text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-400">No users found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
