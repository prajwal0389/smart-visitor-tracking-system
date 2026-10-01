const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { sendOTPEmail } = require('../services/email');
require('dotenv').config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

// Admin/HR/Security login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Host OTP request
router.post('/otp/request', async (req, res) => {
  const { email } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND role=$2', [email, 'host']);
  if (!rows[0]) return res.status(404).json({ error: 'Host not found' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query('UPDATE users SET otp=$1, otp_expires=$2 WHERE id=$3', [otp, expires, rows[0].id]);
  await sendOTPEmail(email, otp);
  res.json({ message: 'OTP sent' });
});

// Host OTP verify
router.post('/otp/verify', async (req, res) => {
  const { email, otp } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND role=$2', [email, 'host']);
  const user = rows[0];
  if (!user || user.otp !== otp || new Date(user.otp_expires) < new Date())
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  await pool.query('UPDATE users SET otp=NULL, otp_expires=NULL WHERE id=$1', [user.id]);
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Google OAuth
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    let { rows } = await pool.query('SELECT * FROM users WHERE google_id=$1 OR email=$2', [payload.sub, payload.email]);
    let user = rows[0];
    if (!user) {
      return res.status(403).json({ error: 'Account not registered. Contact admin.' });
    } else if (!user.google_id) {
      await pool.query('UPDATE users SET google_id=$1 WHERE id=$2', [payload.sub, user.id]);
    }
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// Register user (admin only)
router.post('/register', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role',
    [name, email, hash, role]
  );
  res.json(rows[0]);
});

// PUT /api/auth/users/:id — admin edit user
router.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, role, password } = req.body;
  let q, params;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    q = 'UPDATE users SET name=$1, email=$2, role=$3, password_hash=$4 WHERE id=$5 RETURNING id,name,email,role';
    params = [name, email, role, hash, req.params.id];
  } else {
    q = 'UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4 RETURNING id,name,email,role';
    params = [name, email, role, req.params.id];
  }
  const { rows } = await pool.query(q, params);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// DELETE /api/auth/users/:id — admin delete user
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// POST /api/auth/user-requests — HR submits a request
router.post('/user-requests', authenticate, authorize('hr_admin'), async (req, res) => {
  const { action, target_user_id, payload } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO user_requests (requested_by, action, target_user_id, payload) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, action, target_user_id || null, payload]
  );
  res.json(rows[0]);
});

// GET /api/auth/user-requests — admin sees all pending requests
router.get('/user-requests', authenticate, authorize('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ur.*, u.name as requested_by_name
     FROM user_requests ur
     JOIN users u ON u.id = ur.requested_by
     WHERE ur.status = 'pending'
     ORDER BY ur.created_at DESC`
  );
  res.json(rows);
});

// POST /api/auth/user-requests/:id/review — admin approves or rejects
router.post('/user-requests/:id/review', authenticate, authorize('admin'), async (req, res) => {
  const { decision } = req.body; // 'approved' | 'rejected'
  const { rows } = await pool.query('SELECT * FROM user_requests WHERE id=$1', [req.params.id]);
  const request = rows[0];
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });

  await pool.query(
    'UPDATE user_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3',
    [decision, req.user.id, request.id]
  );

  if (decision === 'approved') {
    const p = request.payload;
    if (request.action === 'add') {
      const hash = await bcrypt.hash(p.password, 10);
      await pool.query(
        'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)',
        [p.name, p.email, hash, p.role]
      );
    } else if (request.action === 'edit' && request.target_user_id) {
      if (p.password) {
        const hash = await bcrypt.hash(p.password, 10);
        await pool.query('UPDATE users SET name=$1,email=$2,role=$3,password_hash=$4 WHERE id=$5', [p.name, p.email, p.role, hash, request.target_user_id]);
      } else {
        await pool.query('UPDATE users SET name=$1,email=$2,role=$3 WHERE id=$4', [p.name, p.email, p.role, request.target_user_id]);
      }
    } else if (request.action === 'delete' && request.target_user_id) {
      await pool.query('DELETE FROM users WHERE id=$1', [request.target_user_id]);
    }
  }
  res.json({ success: true });
});

module.exports = router;
