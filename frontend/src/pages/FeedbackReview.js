import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

function Stars({ rating }) {
  return (
    <span className="text-yellow-400">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function FeedbackReview() {
  const [feedback, setFeedback] = useState([]);
  const avg = feedback.length ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : '—';

  useEffect(() => { api.get('/feedback').then(r => setFeedback(r.data)); }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Feedback Review</h2>
        <div className="card py-2 px-4 flex items-center gap-2">
          <span className="text-yellow-400 text-xl">★</span>
          <span className="font-bold text-lg">{avg}</span>
          <span className="text-gray-400 text-sm">avg ({feedback.length})</span>
        </div>
      </div>
      <div className="grid gap-4">
        {feedback.map(f => (
          <div key={f.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{f.visitor_name}</p>
                <p className="text-gray-400 text-sm">{f.purpose}</p>
              </div>
              <div className="text-right">
                <Stars rating={f.rating} />
                <p className="text-xs text-gray-400 mt-1">{new Date(f.submitted_at).toLocaleDateString()}</p>
              </div>
            </div>
            {f.comments && <p className="mt-3 text-gray-600 text-sm bg-gray-50 rounded-lg p-3">"{f.comments}"</p>}
          </div>
        ))}
        {feedback.length === 0 && (
          <div className="card text-center py-12 text-gray-400">No feedback yet</div>
        )}
      </div>
    </Layout>
  );
}
