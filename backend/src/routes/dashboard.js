const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/dashboardStats
router.get('/dashboardStats', authenticate, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const [todayR, activeR, totalR, pendingR, weeklyR] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM meetings WHERE DATE(scheduled_start)=$1", [today]),
    pool.query(`SELECT COUNT(*) FROM visit_logs vl
      WHERE vl.status='inside'
      AND vl.id = (SELECT id FROM visit_logs WHERE meeting_id=vl.meeting_id ORDER BY id DESC LIMIT 1)`),
    pool.query("SELECT COUNT(*) FROM meetings"),
    pool.query("SELECT COUNT(*) FROM meetings WHERE status='pending'"),
    pool.query(`
      SELECT DATE(scheduled_start) as date, COUNT(*) as count
      FROM meetings
      WHERE scheduled_start >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(scheduled_start) ORDER BY date
    `)
  ]);
  res.json({
    today: parseInt(todayR.rows[0].count),
    active: parseInt(activeR.rows[0].count),
    total: parseInt(totalR.rows[0].count),
    pending: parseInt(pendingR.rows[0].count),
    weekly: weeklyR.rows
  });
});

// GET /api/analytics
router.get('/analytics', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const [byStatus, byHost, byMonth, topVisitors] = await Promise.all([
    pool.query("SELECT status, COUNT(*) FROM meetings GROUP BY status"),
    pool.query(`SELECT u.name, COUNT(m.id) as count FROM meetings m JOIN users u ON u.id=m.host_id GROUP BY u.name ORDER BY count DESC LIMIT 10`),
    pool.query(`SELECT TO_CHAR(scheduled_start,'YYYY-MM') as month, COUNT(*) FROM meetings GROUP BY month ORDER BY month DESC LIMIT 12`),
    pool.query(`SELECT v.name, v.company, COUNT(m.id) as visits FROM visitors v JOIN meetings m ON m.visitor_id=v.id GROUP BY v.id,v.name,v.company ORDER BY visits DESC LIMIT 10`)
  ]);
  res.json({
    byStatus: byStatus.rows,
    byHost: byHost.rows,
    byMonth: byMonth.rows,
    topVisitors: topVisitors.rows
  });
});

// GET /api/meetings
router.get('/meetings', authenticate, async (req, res) => {
  const { status, host_id, date } = req.query;
  let q = `SELECT m.*,v.name as visitor_name,v.email as visitor_email,v.company,v.is_blacklisted,
                  u.name as host_name,vl.status as log_status,vl.entry_time,vl.exit_time
           FROM meetings m JOIN visitors v ON v.id=m.visitor_id JOIN users u ON u.id=m.host_id
           LEFT JOIN visit_logs vl ON vl.meeting_id=m.id WHERE 1=1`;
  const params = [];
  if (req.user.role === 'host') { params.push(req.user.id); q += ` AND m.host_id=$${params.length}`; }
  else if (host_id) { params.push(host_id); q += ` AND m.host_id=$${params.length}`; }
  if (status) { params.push(status); q += ` AND m.status=$${params.length}`; }
  if (date) { params.push(date); q += ` AND DATE(m.scheduled_start)=$${params.length}`; }
  q += ' ORDER BY m.scheduled_start DESC LIMIT 100';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// GET /api/visitors
router.get('/visitors', authenticate, authorize('admin', 'hr_admin', 'security'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM visitors ORDER BY created_at DESC');
  res.json(rows);
});

// GET /api/users
router.get('/users', authenticate, authorize('admin', 'hr_admin', 'security'), async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY name');
  res.json(rows);
});

// GET /api/approvalRules
router.get('/approvalRules', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM approval_rules ORDER BY priority');
  res.json(rows);
});

// POST /api/approvalRules
router.post('/approvalRules', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { name, priority, conditions, action } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO approval_rules (name,priority,conditions,action) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, priority, JSON.stringify(conditions), action]
  );
  res.json(rows[0]);
});

// PUT /api/approvalRules/:id
router.put('/approvalRules/:id', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { name, priority, conditions, action, is_active } = req.body;
  const { rows } = await pool.query(
    'UPDATE approval_rules SET name=$1,priority=$2,conditions=$3,action=$4,is_active=$5 WHERE id=$6 RETURNING *',
    [name, priority, JSON.stringify(conditions), action, is_active, req.params.id]
  );
  res.json(rows[0]);
});

// DELETE /api/approvalRules/:id
router.delete('/approvalRules/:id', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  await pool.query('DELETE FROM approval_rules WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// GET /api/hostActivity
router.get('/hostActivity', authenticate, async (req, res) => {
  const hostId = req.user.role === 'host' ? req.user.id : req.query.host_id;
  const { rows } = await pool.query(
    `SELECT m.*,v.name as visitor_name,v.company,vl.status as log_status,vl.entry_time,vl.exit_time
     FROM meetings m JOIN visitors v ON v.id=m.visitor_id LEFT JOIN visit_logs vl ON vl.meeting_id=m.id
     WHERE m.host_id=$1 ORDER BY m.created_at DESC LIMIT 50`,
    [hostId]
  );
  res.json(rows);
});

// GET /api/feedback
router.get('/feedback', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.*,v.name as visitor_name,m.purpose FROM feedback f
     JOIN visitors v ON v.id=f.visitor_id JOIN meetings m ON m.id=f.meeting_id
     ORDER BY f.submitted_at DESC`
  );
  res.json(rows);
});

// POST /api/feedback
router.post('/feedback', async (req, res) => {
  const { meeting_id, rating, comments, token } = req.body;
  if (!token) return res.status(401).json({ error: 'Invalid feedback link' });
  const jwt = require('jsonwebtoken');
  let tokenPayload;
  try {
    tokenPayload = jwt.verify(token, process.env.JWT_SECRET);
    if (tokenPayload.meeting_id !== parseInt(meeting_id))
      return res.status(403).json({ error: 'Token mismatch' });
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  const { rows: mRows } = await pool.query('SELECT visitor_id FROM meetings WHERE id=$1', [meeting_id]);
  if (!mRows[0]) return res.status(404).json({ error: 'Meeting not found' });
  const { rows } = await pool.query(
    'INSERT INTO feedback (meeting_id,visitor_id,rating,comments) VALUES ($1,$2,$3,$4) RETURNING *',
    [meeting_id, mRows[0].visitor_id, rating, comments]
  );
  res.json(rows[0]);
});

// GET /api/visitorPass/:meeting_id
router.get('/visitorPass/:meeting_id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.*,v.name as visitor_name,v.email,u.name as host_name
     FROM meetings m JOIN visitors v ON v.id=m.visitor_id JOIN users u ON u.id=m.host_id
     WHERE m.id=$1`,
    [req.params.meeting_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  // Don't expose QR token or OTP if not accepted
  const pass = rows[0];
  if (pass.status !== 'accepted') {
    pass.qr_token = null;
    pass.entry_otp = null;
  }
  res.json(pass);
});

module.exports = router;
