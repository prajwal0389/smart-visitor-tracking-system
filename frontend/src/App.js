import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './AuthContext';

import Login from './pages/Login';
import HostLogin from './pages/HostLogin';
import AdminDashboard from './pages/AdminDashboard';
import HRDashboard from './pages/HRDashboard';
import SecurityDashboard from './pages/SecurityDashboard';
import SecurityScanner from './pages/SecurityScanner';
import AttendancePage from './pages/AttendancePage';
import InviteForm from './pages/InviteForm';
import VisitorPass from './pages/VisitorPass';
import { AcceptInvite, RejectInvite, ApprovalAction } from './pages/InviteActions';
import ApprovalRules from './pages/ApprovalRules';
import AnalyticsPage from './pages/AnalyticsPage';
import HostActivity from './pages/HostActivity';
import FeedbackReview from './pages/FeedbackReview';
import Feedback from './pages/Feedback';
import WalkinForm from './pages/WalkinForm';
import VisitorsPage from './pages/VisitorsPage';
import UserManagement from './pages/UserManagement';
import ProtectedRoute from './components/ProtectedRoute';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const map = { admin: '/admin', hr_admin: '/hr', host: '/host', security: '/security' };
  return <Navigate to={map[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || 'placeholder'}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/host-login" element={<HostLogin />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/reject-invite" element={<RejectInvite />} />
            <Route path="/approval-action" element={<ApprovalAction />} />
            <Route path="/visitor-pass/:meeting_id" element={<VisitorPass />} />
            <Route path="/feedback/:meeting_id" element={<Feedback />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/visitors" element={<ProtectedRoute roles={['admin', 'hr_admin']}><VisitorsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['admin', 'hr_admin']}><UserManagement /></ProtectedRoute>} />

            {/* HR */}
            <Route path="/hr" element={<ProtectedRoute roles={['hr_admin']}><HRDashboard /></ProtectedRoute>} />

            {/* Shared admin+hr */}
            <Route path="/attendance" element={<ProtectedRoute roles={['admin', 'hr_admin']}><AttendancePage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute roles={['admin', 'hr_admin']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/approval-rules" element={<ProtectedRoute roles={['admin', 'hr_admin']}><ApprovalRules /></ProtectedRoute>} />
            <Route path="/feedback-review" element={<ProtectedRoute roles={['admin', 'hr_admin']}><FeedbackReview /></ProtectedRoute>} />

            {/* Host */}
            <Route path="/host" element={<ProtectedRoute roles={['host']}><HostActivity /></ProtectedRoute>} />

            {/* Shared invite (admin, hr_admin, host) */}
            <Route path="/invite" element={<ProtectedRoute roles={['admin', 'hr_admin', 'host']}><InviteForm /></ProtectedRoute>} />

            {/* Security */}
            <Route path="/security" element={<ProtectedRoute roles={['security']}><SecurityDashboard /></ProtectedRoute>} />
            <Route path="/scanner" element={<ProtectedRoute roles={['security']}><SecurityScanner /></ProtectedRoute>} />
            <Route path="/walkin" element={<ProtectedRoute roles={['security']}><WalkinForm /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
