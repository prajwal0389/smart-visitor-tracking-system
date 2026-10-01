import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function InviteForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hosts, setHosts] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '',
    purpose: '', visit_type: 'meeting',
    scheduled_start: '', scheduled_end: '',
    host_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user.role !== 'host') {
      api.get('/users').then(r => setHosts(r.data.filter(u => u.role === 'host')));
    }
  }, [user.role]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const payload = { ...form };
      if (user.role === 'host') delete payload.host_id;
      const { data } = await api.post('/inviteVisitor', payload);
      if (data.emailDelivery !== 'smtp_accepted') {
        setError('Invite created, but its email was not accepted by SMTP. Check the backend mail log.');
        return;
      }
      setSuccess(`Invite created! Rule action: ${data.ruleAction}`);
      setTimeout(() => navigate(user.role === 'host' ? '/host' : user.role === 'hr_admin' ? '/hr' : '/admin'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create invite');
    } finally { setLoading(false); }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Invite Visitor</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{success}</div>}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                <select className="input" value={form.visit_type} onChange={e => set('visit_type', e.target.value)}>
                  <option value="meeting">Meeting</option>
                  <option value="interview">Interview</option>
                  <option value="delivery">Delivery</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {user.role !== 'host' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host *</label>
                  <select className="input" value={form.host_id} onChange={e => set('host_id', e.target.value)} required>
                    <option value="">Select host</option>
                    {hosts.length === 0 && <option disabled>No hosts registered yet</option>}
                    {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start *</label>
                <input className="input" type="datetime-local" value={form.scheduled_start}
                  onChange={e => set('scheduled_start', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End *</label>
                <input className="input" type="datetime-local" value={form.scheduled_end}
                  onChange={e => set('scheduled_end', e.target.value)} required />
              </div>
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending Invite...' : 'Send Invite'}
            </button>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
