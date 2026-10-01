import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

export default function SecurityScanner() {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [mode, setMode] = useState('qr'); // 'qr' | 'otp' | 'checkout'
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [otp, setOtp] = useState('');
  const [insideVisitors, setInsideVisitors] = useState([]);
  const [checkoutSearch, setCheckoutSearch] = useState('');
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (mode !== 'qr') {
      try { readerRef.current?.reset(); } catch {}
      return;
    }
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    async function startScanner() {
      const devices = await navigator.mediaDevices?.enumerateDevices() || [];
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const backCam = videoDevices.find(d => /back|rear|environment/i.test(d.label));
      const deviceId = backCam?.deviceId || videoDevices[videoDevices.length - 1]?.deviceId || undefined;
      reader.decodeFromVideoDevice(deviceId, videoRef.current, async (res) => {
        if (res && !cooldownRef.current) {
          cooldownRef.current = true;
          setProcessing(true);
          const token = res.getText();
          try {
            let parsed;
            try { parsed = JSON.parse(token); } catch { parsed = null; }
            if (parsed?.type === 'exit') {
              const { data } = await api.post('/visitorExit', { token });
              setResult({ type: 'exit', success: true, message: 'Exit recorded!', data });
            } else {
              const { data } = await api.post('/scanQR', { token });
              setResult({ type: 'entry', success: true, message: 'Entry recorded!', data });
            }
          } catch (e) {
            setResult({ success: false, message: e.response?.data?.error || 'Scan failed' });
          }
          setProcessing(false);
          setScanning(false);
          setTimeout(() => { cooldownRef.current = false; setScanning(true); setResult(null); }, 4000);
        }
      });
    }
    startScanner();
    return () => { try { reader.reset(); } catch {} };
  }, [mode]);

  useEffect(() => {
    if (mode === 'checkout') {
      api.get('/meetings').then(r => {
        setInsideVisitors(r.data.filter(m => m.log_status === 'inside'));
      });
    }
  }, [mode]);

  async function handleOTPSubmit(e) {
    e.preventDefault();
    if (!otp.trim()) return;
    setProcessing(true); setResult(null);
    try {
      const { data } = await api.post('/verifyOTP', { otp: otp.trim() });
      setResult({ success: true, message: 'Entry recorded!', data });
      setOtp('');
    } catch (e) {
      setResult({ success: false, message: e.response?.data?.error || 'Invalid OTP' });
    }
    setProcessing(false);
    setTimeout(() => setResult(null), 4000);
  }

  async function handleManualCheckout(meeting_id, visitor_name) {
    setProcessing(true); setResult(null);
    try {
      await api.post('/manualCheckout', { meeting_id });
      setResult({ success: true, message: `${visitor_name} checked out!` });
      setInsideVisitors(v => v.filter(x => x.id !== meeting_id));
    } catch (e) {
      setResult({ success: false, message: e.response?.data?.error || 'Checkout failed' });
    }
    setProcessing(false);
    setTimeout(() => setResult(null), 4000);
  }

  const filteredVisitors = insideVisitors.filter(m =>
    m.visitor_name?.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
    m.company?.toLowerCase().includes(checkoutSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/50 z-10">
        <h1 className="text-white font-bold text-lg">📷 Scanner</h1>
        <a href="/security" className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">← Back</a>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-black/50 px-4 pb-2 gap-2">
        <button onClick={() => setMode('qr')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'qr' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70'}`}>
          📷 Scan QR
        </button>
        <button onClick={() => setMode('otp')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'otp' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70'}`}>
          🔢 Enter OTP
        </button>
        <button onClick={() => setMode('checkout')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'checkout' ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70'}`}>
          🚪 Checkout
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {mode === 'qr' ? (
          <>
            <video ref={videoRef} className="w-full h-full" style={{ objectFit: 'contain', background: '#000' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-white/70 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />
                {scanning && <motion.div animate={{ y: [0, 220, 0] }} transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-400 shadow-lg shadow-indigo-400" />}
              </div>
            </div>
            <p className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-sm">
              {processing ? '⏳ Processing...' : 'Point camera at QR code'}
            </p>
          </>
        ) : mode === 'otp' ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm">
              <h2 className="text-xl font-bold text-center mb-2">Enter Visitor OTP</h2>
              <p className="text-gray-500 text-sm text-center mb-6">Ask the visitor for the 6-digit code from their confirmation email</p>
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-3xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={processing || otp.length !== 6}
                  className="w-full bg-indigo-500 text-white py-3 rounded-xl font-medium disabled:opacity-50">
                  {processing ? '⏳ Verifying...' : 'Verify & Allow Entry'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full bg-white overflow-y-auto">
            <div className="p-4">
              <h2 className="text-xl font-bold mb-1">Manual Checkout</h2>
              <p className="text-gray-500 text-sm mb-4">Visitors currently inside the premises</p>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="Search by name or company..."
                value={checkoutSearch}
                onChange={e => setCheckoutSearch(e.target.value)}
              />
              {filteredVisitors.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No visitors currently inside</p>
              ) : (
                <div className="space-y-3">
                  {filteredVisitors.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="font-semibold text-gray-800">{m.visitor_name}</p>
                        <p className="text-xs text-gray-400">{m.company || 'N/A'} · Host: {m.host_name}</p>
                        <p className="text-xs text-gray-400">In since: {m.entry_time ? new Date(m.entry_time).toLocaleTimeString() : 'Unknown'}</p>
                      </div>
                      <button
                        onClick={() => handleManualCheckout(m.id, m.visitor_name)}
                        disabled={processing}
                        className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                        🚪 Checkout
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className={`absolute bottom-0 left-0 right-0 p-6 rounded-t-3xl ${result.success ? 'bg-green-500' : 'bg-red-500'}`}>
            <div className="text-white text-center">
              <p className="text-4xl mb-2">{result.success ? '✅' : '❌'}</p>
              <p className="text-xl font-bold">{result.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
