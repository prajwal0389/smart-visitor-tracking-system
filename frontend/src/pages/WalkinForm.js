import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';

export default function WalkinForm() {
  const navigate = useNavigate();
  const [hosts, setHosts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', company: '', purpose: '', host_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/users').then(r => setHosts(r.data.filter(u => u.role === 'host' || u.role === 'admin' || u.role === 'hr_admin')));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/walkinVisitor', form);
      setSuccess('Walk-in registered! Approval request sent to host.');
      setTimeout(() => navigate('/security'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register walk-in');
    } finally { setLoading(false); }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-6">Register Walk-in Visitor</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{success}</div>}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input className="input" value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
              <textarea className="input" rows={2} value={form.purpose} onChange={e => set('purpose', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Host to Visit *</label>
              <select className="input" value={form.host_id} onChange={e => set('host_id', e.target.value)} required>
                <option value="">Select host</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.role})</option>)}
              </select>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Registering...' : 'Register Walk-in'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
