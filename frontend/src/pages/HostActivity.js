import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api';

export default function HostActivity() {
  const [meetings, setMeetings] = useState([]);

  useEffect(() => { api.get('/hostActivity').then(r => setMeetings(r.data)); }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">My Activity</h2>
        <Link to="/invite" className="btn-primary">+ Invite Visitor</Link>
      </div>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Visitor</th>
                <th className="pb-2">Purpose</th>
                <th className="pb-2">Scheduled</th>
                <th className="pb-2">Meeting</th>
                <th className="pb-2">Visit</th>
                <th className="pb-2">Entry</th>
                <th className="pb-2">Exit</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2">
                    <p className="font-medium">{m.visitor_name}</p>
                    <p className="text-gray-400 text-xs">{m.company}</p>
                  </td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{m.purpose}</td>
                  <td className="py-2 text-gray-500">{new Date(m.scheduled_start).toLocaleString()}</td>
                  <td className="py-2"><StatusBadge status={m.status} /></td>
                  <td className="py-2"><StatusBadge status={m.log_status || 'pending'} /></td>
                  <td className="py-2 text-gray-400 text-xs">{m.entry_time ? new Date(m.entry_time).toLocaleTimeString() : '—'}</td>
                  <td className="py-2 text-gray-400 text-xs">{m.exit_time ? new Date(m.exit_time).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">No meetings yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
