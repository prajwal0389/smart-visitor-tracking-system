import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/visitors').then(r => setVisitors(r.data)); }, []);

  async function toggleBlacklist(v) {
    if (v.is_blacklisted) {
      await api.delete(`/blacklist/${v.id}`);
      setVisitors(vs => vs.map(x => x.id === v.id ? { ...x, is_blacklisted: false, blacklist_reason: null } : x));
    } else {
      const reason = prompt('Reason for blacklisting?');
      if (!reason) return;
      await api.post(`/blacklist/${v.id}`, { reason });
      setVisitors(vs => vs.map(x => x.id === v.id ? { ...x, is_blacklisted: true, blacklist_reason: reason } : x));
    }
  }

  const filtered = visitors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.email.toLowerCase().includes(search.toLowerCase()) ||
    (v.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Visitors</h2>
        <input className="input w-64" placeholder="Search name, email, company..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Name</th><th className="pb-2">Email</th>
                <th className="pb-2">Company</th><th className="pb-2">Phone</th>
                <th className="pb-2">Status</th><th className="pb-2">Reason</th><th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className={`border-b border-gray-50 hover:bg-gray-50 ${v.is_blacklisted ? 'bg-red-50' : ''}`}>
                  <td className="py-2 font-medium">{v.name}</td>
                  <td className="py-2 text-gray-500">{v.email.startsWith('walkin_') ? <em className="text-gray-300">walk-in</em> : v.email}</td>
                  <td className="py-2">{v.company || '—'}</td>
                  <td className="py-2 text-gray-500">{v.phone || '—'}</td>
                  <td className="py-2">
                    {v.is_blacklisted ? <span className="badge-red">Blacklisted</span> : <span className="badge-green">Active</span>}
                  </td>
                  <td className="py-2 text-gray-400 text-xs max-w-xs truncate">{v.blacklist_reason || '—'}</td>
                  <td className="py-2">
                    <button onClick={() => toggleBlacklist(v)}
                      className={`text-xs hover:underline ${v.is_blacklisted ? 'text-green-600' : 'text-red-500'}`}>
                      {v.is_blacklisted ? 'Remove' : 'Blacklist'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No visitors found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
