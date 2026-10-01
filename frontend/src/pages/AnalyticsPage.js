import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import Layout from '../components/Layout';
import api from '../api';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/analytics').then(r => setData(r.data)); }, []);

  if (!data) return <Layout><p className="text-gray-400">Loading analytics...</p></Layout>;

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Analytics</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card">
          <h3 className="font-semibold mb-4">Visits by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={e => e.status}>
                {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Visits by Month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis /><Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Top Hosts by Visits</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byHost} layout="vertical">
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Top Visitors</h3>
          <div className="space-y-2">
            {data.topVisitors.map((v, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-gray-400">{v.company}</p>
                </div>
                <span className="badge-indigo badge bg-indigo-100 text-indigo-800">{v.visits} visits</span>
              </div>
            ))}
            {data.topVisitors.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data yet</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
