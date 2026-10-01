const map = {
  accepted: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red',
  cancelled: 'badge-gray', completed: 'badge-blue',
  inside: 'badge-green', exited: 'badge-blue', denied: 'badge-red',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}
