import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function HostLogin() {
  const [step, setStep] = useState('email'); // email | otp
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function requestOTP(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/otp/request', { email });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function verifyOTP(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/otp/verify', { email, otp });
      login(data.token, data.user);
      navigate('/host');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  }

  async function handleGoogle(credential) {
    try {
      const { data } = await api.post('/auth/google', { credential });
      login(data.token, data.user);
      navigate('/host');
    } catch (err) {
      setError('Google login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">🏠 Host Login</h1>
        <p className="text-center text-gray-500 text-sm mb-6">OTP or Google Sign-In</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        {step === 'email' ? (
          <form onSubmit={requestOTP} className="space-y-4">
            <input className="input" type="email" placeholder="Your email" value={email}
              onChange={e => setEmail(e.target.value)} required />
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} className="space-y-4">
            <p className="text-sm text-gray-600">OTP sent to <b>{email}</b></p>
            <input className="input text-center text-2xl tracking-widest" type="text"
              placeholder="000000" maxLength={6} value={otp}
              onChange={e => setOtp(e.target.value)} required />
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="btn-outline w-full">
              Back
            </button>
          </form>
        )}

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex justify-center">
          <GoogleLogin onSuccess={r => handleGoogle(r.credential)} onError={() => setError('Google login failed')} />
        </div>
      </motion.div>
    </div>
  );
}
