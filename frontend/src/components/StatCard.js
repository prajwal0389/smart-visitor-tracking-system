import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="card flex items-center gap-4">
      <div className={`text-3xl p-3 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value ?? '—'}</p>
      </div>
    </motion.div>
  );
}
