import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const roleRedirect = { admin: '/admin', hr_admin: '/hr', security: '/security', host: '/host' };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      navigate(roleRedirect[data.user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">🏢 VMS Login</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Admin / HR / Security</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" type="email" placeholder="Email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="input" type="password" placeholder="Password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Host? <Link to="/host-login" className="text-indigo-600 hover:underline">Login here</Link>
        </p>
      </motion.div>
    </div>
  );
}
