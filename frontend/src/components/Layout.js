import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { motion } from 'framer-motion';

const navItems = {
  admin: [
    { to: '/admin', label: '📊 Dashboard' },
    { to: '/invite', label: '✉️ Invite Visitor' },
    { to: '/attendance', label: '📋 Attendance' },
    { to: '/analytics', label: '📈 Analytics' },
    { to: '/approval-rules', label: '⚙️ Rules' },
    { to: '/feedback-review', label: '💬 Feedback' },
    { to: '/visitors', label: '👥 Visitors' },
    { to: '/users', label: '🔧 Manage Users' },
  ],
  hr_admin: [
    { to: '/hr', label: '📊 Dashboard' },
    { to: '/invite', label: '✉️ Invite Visitor' },
    { to: '/attendance', label: '📋 Attendance' },
    { to: '/analytics', label: '📈 Analytics' },
    { to: '/approval-rules', label: '⚙️ Rules' },
    { to: '/feedback-review', label: '💬 Feedback' },
    { to: '/visitors', label: '👥 Visitors' },
    { to: '/users', label: '👤 Users' },
  ],
  host: [
    { to: '/host', label: '🏠 My Activity' },
    { to: '/invite', label: '✉️ Invite Visitor' },
  ],
  security: [
    { to: '/security', label: '🛡️ Dashboard' },
    { to: '/scanner', label: '📷 Scanner' },
    { to: '/walkin', label: '🚶 Walk-in' },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-indigo-900 text-white flex flex-col">
        <div className="p-4 border-b border-indigo-800">
          <h1 className="text-lg font-bold">🏢 VMS</h1>
          <p className="text-xs text-indigo-300 mt-1">{user?.name}</p>
          <span className="text-xs bg-indigo-700 px-2 py-0.5 rounded-full">{user?.role}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === item.to
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="m-3 px-3 py-2 text-sm text-indigo-300 hover:text-white hover:bg-indigo-800 rounded-lg text-left"
        >
          🚪 Logout
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-6"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
