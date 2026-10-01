const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { sendExitQRPass, sendGoodbyeEmail, sendCheckinConfirmation } = require('../services/email');
const { generateExitQR } = require('../services/qr');

// POST /api/attendance/mark
router.post('/mark', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  try {
  const { meeting_id, action } = req.body; // action: 'entry' | 'exit'
  const { rows } = await pool.query(
    `SELECT m.*,v.name,v.email,v.company FROM meetings m JOIN visitors v ON v.id=m.visitor_id WHERE m.id=$1`,
    [meeting_id]
  );
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  const visitor = { name: meeting.name, email: meeting.email };

  const { rows: logRows } = await pool.query(
    'SELECT status FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1', [meeting_id]
  );
  const logStatus = logRows[0]?.status;

  if (action === 'entry') {
    if (logStatus === 'inside') return res.status(400).json({ error: 'Already inside' });
    if (logStatus === 'exited') return res.status(400).json({ error: 'Visit already completed' });
    const { rowCount } = await pool.query(
      "UPDATE visit_logs SET status='inside', entry_time=NOW(), entry_by=$1 WHERE meeting_id=$2",
      [req.user.id, meeting_id]
    );
    if (rowCount === 0) {
      await pool.query(
        "INSERT INTO visit_logs (meeting_id,visitor_id,status,entry_time,entry_by) VALUES ($1,$2,'inside',NOW(),$3)",
        [meeting_id, meeting.visitor_id, req.user.id]
      );
    }
    try { await sendCheckinConfirmation(visitor, meeting); } catch(e) { console.error('Email error:', e.message); }
    setTimeout(async () => {
      try {
        const { rows: lr } = await pool.query('SELECT id,status,exit_qr_sent FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1', [meeting_id]);
        if (lr[0]?.status === 'inside' && !lr[0]?.exit_qr_sent) {
          const exitQr = generateExitQR(meeting_id);
          try { await sendExitQRPass(visitor, meeting, exitQr); } catch(e) { console.error('Email error:', e.message); }
          await pool.query('UPDATE visit_logs SET exit_qr_sent=TRUE, exit_qr_sent_at=NOW() WHERE id=$1', [lr[0].id]);
        }
      } catch (err) {
        console.error('Attendance exit QR reminder error:', err);
      }
    }, 20 * 60 * 1000);
  } else {
    await pool.query(
      "UPDATE visit_logs SET status='exited', exit_time=NOW(), exit_by=$1 WHERE meeting_id=$2",
      [req.user.id, meeting_id]
    );
    await pool.query("UPDATE meetings SET status='completed' WHERE id=$1", [meeting_id]);
    try { await sendGoodbyeEmail(visitor, meeting); } catch(e) { console.error('Email error:', e.message); }
  }
  res.json({ success: true });
  } catch (err) {
    console.error('Attendance check-in error:', err);
    res.status(500).json({ error: 'Unable to update attendance right now' });
  }
});

// POST /api/attendance/resend-exit-mail
router.post('/resend-exit-mail', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { meeting_id } = req.body;
  const { rows } = await pool.query(
    `SELECT m.*,v.*,vl.status as log_status FROM meetings m
     JOIN visitors v ON v.id=m.visitor_id
     JOIN visit_logs vl ON vl.meeting_id=m.id
     WHERE m.id=$1`,
    [meeting_id]
  );
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.log_status !== 'exited') return res.status(400).json({ error: 'Visitor has not exited' });
  const exitQr = generateExitQR(meeting_id);
  await sendExitQRPass({ name: r.name, email: r.email }, r, exitQr);
  await sendGoodbyeEmail({ name: r.name, email: r.email }, r);
  res.json({ success: true });
});

// GET /api/attendance
router.get('/', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT m.id,m.purpose,m.scheduled_start,m.status,m.is_walkin,
            v.name as visitor_name,v.email as visitor_email,v.company,
            u.name as host_name,
            vl.status as log_status,vl.entry_time,vl.exit_time
     FROM meetings m
     JOIN visitors v ON v.id=m.visitor_id
     JOIN users u ON u.id=m.host_id
     LEFT JOIN visit_logs vl ON vl.meeting_id=m.id
     WHERE DATE(m.scheduled_start)=$1
     ORDER BY m.scheduled_start DESC`,
    [d]
  );
  res.json(rows);
});

module.exports = router;
