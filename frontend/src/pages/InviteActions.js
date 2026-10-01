import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function AcceptInvite() {
  const [params] = useSearchParams();
  const meetingId = params.get('meeting');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md w-full">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Invite Accepted!</h1>
        <p className="text-gray-500 mb-6">A confirmation email with your QR pass has been sent.</p>
        {meetingId && (
          <Link to={`/visitor-pass/${meetingId}`} className="btn-primary inline-block">
            View My Pass
          </Link>
        )}
      </motion.div>
    </div>
  );
}

export function RejectInvite() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 to-red-700">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md w-full">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold mb-2">Invite Declined</h1>
        <p className="text-gray-500">You have declined the visit invitation.</p>
      </motion.div>
    </div>
  );
}

export function ApprovalAction() {
  const [params] = useSearchParams();
  const result = params.get('result');
  const approved = result === 'approved';
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${approved ? 'from-green-900 to-green-700' : 'from-red-900 to-red-700'}`}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md w-full">
        <div className="text-6xl mb-4">{approved ? '✅' : '❌'}</div>
        <h1 className="text-2xl font-bold mb-2">{approved ? 'Visit Approved' : 'Visit Rejected'}</h1>
        <p className="text-gray-500">
          {approved ? 'The visitor has been notified with their QR pass.' : 'The visitor has been notified.'}
        </p>
      </motion.div>
    </div>
  );
}
