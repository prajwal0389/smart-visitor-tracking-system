import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';

export default function Feedback() {
  const { meeting_id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) return setError('Please select a rating');
    try {
      await api.post('/feedback', { meeting_id: parseInt(meeting_id), rating, comments, token });
      setSubmitted(true);
    } catch { setError('Failed to submit feedback'); }
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
        className="bg-white rounded-2xl p-10 text-center max-w-md w-full shadow-xl">
        <div className="text-6xl mb-4">🙏</div>
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-gray-500">Your feedback has been recorded.</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">How was your visit?</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Your feedback helps us improve</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                className={`text-4xl transition-transform hover:scale-110 ${(hover || rating) >= s ? 'text-yellow-400' : 'text-gray-200'}`}>
                ★
              </button>
            ))}
          </div>
          <textarea className="input" rows={4} placeholder="Share your experience (optional)"
            value={comments} onChange={e => setComments(e.target.value)} />
          <button className="btn-primary w-full" type="submit">Submit Feedback</button>
        </form>
      </motion.div>
    </div>
  );
}
