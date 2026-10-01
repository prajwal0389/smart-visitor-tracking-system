import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import api from '../api';

export default function VisitorPass() {
  const { meeting_id } = useParams();
  const [pass, setPass] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/visitorPass/${meeting_id}`)
      .then(r => setPass(r.data))
      .catch(() => setError('Pass not found'));
  }, [meeting_id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card text-center"><p className="text-red-500">{error}</p></div>
    </div>
  );

  if (!pass) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Loading pass...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-2">🎫</div>
        <h1 className="text-xl font-bold mb-1">Visitor Pass</h1>
        <p className="text-gray-500 text-sm mb-4">Show this at the entrance</p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="font-semibold text-lg">{pass.visitor_name}</p>
          <p className="text-gray-500 text-sm">Meeting with {pass.host_name}</p>
          <p className="text-gray-400 text-xs mt-1">{new Date(pass.scheduled_start).toLocaleString()}</p>
        </div>

        {pass.qr_token ? (
          <div className="flex justify-center mb-4">
            <QRCodeSVG value={pass.qr_token} size={200} level="H" />
          </div>
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 mx-auto mb-4">No QR</div>
        )}

        {pass.entry_otp && (
          <div className="bg-indigo-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">If QR can't be scanned, use this code:</p>
            <p className="text-3xl font-bold tracking-widest text-indigo-600">{pass.entry_otp}</p>
          </div>
        )}

        <div className="mt-2 pt-4 border-t border-gray-100">
          <span className={`badge ${pass.status === 'accepted' ? 'badge-green' : 'badge-yellow'}`}>
            {pass.status}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
