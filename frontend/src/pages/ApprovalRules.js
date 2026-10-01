import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import api from '../api';

const EMPTY = { name: '', priority: 1, action: 'REQUIRE_APPROVAL', conditions: {}, is_active: true };
const ACTIONS = ['APPROVED', 'REJECTED', 'REQUIRE_APPROVAL'];
const COND_KEYS = ['company', 'company_contains', 'host_role', 'visit_type', 'time_start', 'time_end', 'purpose_contains', 'blacklisted'];

export default function ApprovalRules() {
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [condKey, setCondKey] = useState('company');
  const [condVal, setCondVal] = useState('');

  useEffect(() => { api.get('/approvalRules').then(r => setRules(r.data)); }, []);

  function startEdit(rule) {
    setEditing(rule.id);
    setForm({ name: rule.name, priority: rule.priority, action: rule.action, conditions: rule.conditions, is_active: rule.is_active });
  }

  function addCondition() {
    if (!condVal) return;
    const val = condKey === 'blacklisted' ? condVal === 'true' : condVal;
    setForm(f => ({ ...f, conditions: { ...f.conditions, [condKey]: val } }));
    setCondVal('');
  }

  function removeCondition(k) {
    setForm(f => { const c = { ...f.conditions }; delete c[k]; return { ...f, conditions: c }; });
  }

  async function save() {
    if (editing === 'new') {
      const { data } = await api.post('/approvalRules', form);
      setRules(r => [...r, data]);
    } else {
      const { data } = await api.put(`/approvalRules/${editing}`, form);
      setRules(r => r.map(x => x.id === editing ? data : x));
    }
    setEditing(null); setForm(EMPTY);
  }

  async function del(id) {
    if (!window.confirm('Delete this rule?')) return;
    await api.delete(`/approvalRules/${id}`);
    setRules(r => r.filter(x => x.id !== id));
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Approval Rules</h2>
        <button className="btn-primary" onClick={() => { setEditing('new'); setForm(EMPTY); }}>+ New Rule</button>
      </div>

      {editing && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card mb-6">
          <h3 className="font-semibold mb-4">{editing === 'new' ? 'New Rule' : 'Edit Rule'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input className="input" type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select className="input" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
            <div className="flex gap-2 mb-2">
              <select className="input w-auto" value={condKey} onChange={e => setCondKey(e.target.value)}>
                {COND_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input className="input flex-1" placeholder="value" value={condVal} onChange={e => setCondVal(e.target.value)} />
              <button className="btn-outline" onClick={addCondition}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(form.conditions).map(([k, v]) => (
                <span key={k} className="badge-blue flex items-center gap-1">
                  {k}: {String(v)}
                  <button onClick={() => removeCondition(k)} className="ml-1 text-blue-600 hover:text-blue-800">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="active" className="text-sm">Active</label>
          </div>

          <div className="flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="card">
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className={`flex items-center justify-between p-4 rounded-xl border ${rule.is_active ? 'border-indigo-100 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-300">#{rule.priority}</span>
                <div>
                  <p className="font-medium">{rule.name || 'Unnamed Rule'}</p>
                  <p className="text-xs text-gray-500">{Object.entries(rule.conditions).map(([k, v]) => `${k}=${v}`).join(', ') || 'No conditions'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${rule.action === 'APPROVED' ? 'badge-green' : rule.action === 'REJECTED' ? 'badge-red' : 'badge-yellow'}`}>
                  {rule.action}
                </span>
                <button onClick={() => startEdit(rule)} className="text-indigo-600 hover:underline text-sm">Edit</button>
                <button onClick={() => del(rule.id)} className="text-red-500 hover:underline text-sm">Delete</button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="text-gray-400 text-center py-8">No rules yet. Create one to get started.</p>}
        </div>
      </div>
    </Layout>
  );
}
