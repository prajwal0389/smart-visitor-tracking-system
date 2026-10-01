const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { evaluateRules } = require('../services/ruleEngine');
const { generateEntryQR, generateEntryOTP, generateExitQR } = require('../services/qr');
const {
  sendInviteEmail, sendConfirmationWithQR, sendApprovalEmail,
  sendCheckinConfirmation, sendExitQRPass, sendGoodbyeEmail
} = require('../services/email');
const { sendSlackNotification } = require('../services/slack');

async function safeMail(fn, context = {}) {
  try {
    const info = await fn();
    const accepted = info?.accepted?.length || 0;
    const rejected = info?.rejected?.length || 0;
    const status = info?.skipped ? 'skipped' : accepted > 0 && rejected === 0 ? 'smtp_accepted' : 'smtp_rejected';
    console.log('Email submission:', { ...context, status, accepted, rejected });
    return status;
  } catch (err) {
    console.error('Email submission failed:', {
      ...context, attempted: !!err.smtpAttempted,
      code: err.code || null, responseCode: err.responseCode || null,
      command: err.command || null
    });
    return 'failed';
  }
}

function scheduleExitQR(meetingId, visitor, meeting) {
  setTimeout(async () => {
    try {
      const { rows } = await pool.query(
        'SELECT id, status, exit_qr_sent FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1',
        [meetingId]
      );
      const log = rows[0];
      if (log?.status === 'inside' && !log.exit_qr_sent) {
        await safeMail(() => sendExitQRPass(visitor, meeting, meeting.exit_qr_token));
        await pool.query('UPDATE visit_logs SET exit_qr_sent=TRUE, exit_qr_sent_at=NOW() WHERE id=$1', [log.id]);
      }
    } catch (err) {
      console.error('Exit QR reminder error:', err);
    }
  }, 20 * 60 * 1000);
}

async function acceptMeeting(meetingId, visitorId, scheduledEnd) {
  const qrToken = generateEntryQR(visitorId, meetingId, scheduledEnd);
  const exitQrToken = generateExitQR(meetingId);
  const otp = generateEntryOTP();
  const otpExpires = new Date(Math.max(
    scheduledEnd ? new Date(scheduledEnd).getTime() : 0,
    Date.now() + 24 * 60 * 60 * 1000
  ));
  await pool.query(
    'UPDATE meetings SET status=$1, qr_token=$2, exit_qr_token=$3, entry_otp=$4, entry_otp_expires=$5 WHERE id=$6',
    ['accepted', qrToken, exitQrToken, otp, otpExpires, meetingId]
  );
  return { qrToken, exitQrToken, otp };
}

// POST /api/inviteVisitor
router.post('/inviteVisitor', authenticate, authorize('admin', 'hr_admin', 'host'), async (req, res) => {
  const { name, email, phone, company, purpose, visit_type, scheduled_start, scheduled_end } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { rows: vRows } = await client.query('SELECT * FROM visitors WHERE email=$1', [email]);
    let visitor = vRows[0];
    if (!visitor) {
      const r = await client.query(
        'INSERT INTO visitors (name,email,phone,company) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, email, phone, company]
      );
      visitor = r.rows[0];
    }
    if (visitor.is_blacklisted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Visitor is blacklisted' });
    }
    const { rows: hostRows } = await client.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const host = hostRows[0];
    const ruleAction = await evaluateRules(visitor, { purpose, visit_type }, host);
    const inviteToken = uuidv4();
    const { rows: mRows } = await client.query(
      `INSERT INTO meetings (visitor_id,host_id,purpose,visit_type,scheduled_start,scheduled_end,status,invite_token,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [visitor.id, req.user.id, purpose, visit_type, scheduled_start, scheduled_end,
       ruleAction === 'APPROVED' ? 'accepted' : ruleAction === 'REJECTED' ? 'rejected' : 'pending',
       inviteToken, req.user.id]
    );
    const meeting = mRows[0];
    await client.query(
      'INSERT INTO visit_logs (meeting_id,visitor_id,status) VALUES ($1,$2,$3)',
      [meeting.id, visitor.id, 'pending']
    );
    await client.query('COMMIT');

    let emailDelivery = 'not_sent';
    if (ruleAction === 'REQUIRE_APPROVAL') {
      if (req.user.role === 'admin' || req.user.role === 'hr_admin') {
        const { qrToken, otp } = await acceptMeeting(meeting.id, visitor.id, meeting.scheduled_end);
        meeting.status = 'accepted';
        emailDelivery = await safeMail(
          () => sendConfirmationWithQR(visitor, meeting, qrToken, otp),
          { meetingId: meeting.id, type: 'visit_confirmation' }
        );
      } else {
        const approvers = await pool.query(
          "SELECT * FROM users WHERE role IN ('admin','hr_admin') AND id != $1", [req.user.id]
        );
        for (const approver of approvers.rows) {
          const approveToken = uuidv4();
          const rejectToken = uuidv4();
          await pool.query(
            'INSERT INTO approvals (meeting_id,approver_id,action,approve_token,reject_token) VALUES ($1,$2,$3,$4,$5)',
            [meeting.id, approver.id, 'pending', approveToken, rejectToken]
          );
          const delivery = await safeMail(
            () => sendApprovalEmail(approver, visitor, meeting, approveToken, rejectToken),
            { meetingId: meeting.id, type: 'approval_request' }
          );
          if (emailDelivery === 'not_sent' || delivery !== 'smtp_accepted') emailDelivery = delivery;
        }
      }
    } else if (ruleAction === 'APPROVED') {
      const { qrToken, otp } = await acceptMeeting(meeting.id, visitor.id, meeting.scheduled_end);
      emailDelivery = await safeMail(
        () => sendConfirmationWithQR(visitor, meeting, qrToken, otp),
        { meetingId: meeting.id, type: 'visit_confirmation' }
      );
    } else {
      emailDelivery = await safeMail(
        () => sendInviteEmail(visitor, meeting, host, inviteToken),
        { meetingId: meeting.id, type: 'visit_invitation' }
      );
    }
    res.json({ meeting, visitor, ruleAction, emailDelivery });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/acceptInvite/:token
router.get('/acceptInvite/:token', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM meetings WHERE invite_token=$1', [req.params.token]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).send('Invalid invite link');

  if (meeting.status === 'accepted' && meeting.qr_token) {
    return res.redirect(`${process.env.FRONTEND_URL}/accept-invite?meeting=${meeting.id}`);
  }

  const { qrToken, otp } = await acceptMeeting(meeting.id, meeting.visitor_id, meeting.scheduled_end);
  const { rows: vRows } = await pool.query('SELECT * FROM visitors WHERE id=$1', [meeting.visitor_id]);
  await safeMail(
    () => sendConfirmationWithQR(vRows[0], meeting, qrToken, otp),
    { meetingId: meeting.id, type: 'visit_confirmation' }
  );
  res.redirect(`${process.env.FRONTEND_URL}/accept-invite?meeting=${meeting.id}`);
});

// GET /api/declineInvite/:token
router.get('/declineInvite/:token', async (req, res) => {
  await pool.query("UPDATE meetings SET status='rejected' WHERE invite_token=$1", [req.params.token]);
  res.redirect(`${process.env.FRONTEND_URL}/reject-invite`);
});

// GET /api/approvalAction/:token/:action
router.get('/approvalAction/:token/:action', async (req, res) => {
  const { token, action } = req.params;
  if (!['approve', 'reject'].includes(action)) return res.status(400).send('Invalid action');
  const { rows } = await pool.query(
    'SELECT * FROM approvals WHERE approve_token=$1 OR reject_token=$1', [token]
  );
  const approval = rows[0];
  if (!approval) return res.status(404).send('Invalid approval link');
  if (approval.action !== 'pending') return res.send('Already responded');

  const dbAction = action === 'approve' ? 'approved' : 'rejected';
  await pool.query('UPDATE approvals SET action=$1, responded_at=NOW() WHERE id=$2', [dbAction, approval.id]);

  if (dbAction === 'approved') {
    const { rows: mRows } = await pool.query('SELECT * FROM meetings WHERE id=$1 AND status=$2', [approval.meeting_id, 'pending']);
    const meeting = mRows[0];
    if (!meeting) return res.redirect(`${process.env.FRONTEND_URL}/approval-action?result=approved`);
    const { qrToken, otp } = await acceptMeeting(meeting.id, meeting.visitor_id, meeting.scheduled_end);
    const { rows: vRows } = await pool.query('SELECT * FROM visitors WHERE id=$1', [meeting.visitor_id]);
    await safeMail(
      () => sendConfirmationWithQR(vRows[0], meeting, qrToken, otp),
      { meetingId: meeting.id, type: 'visit_confirmation' }
    );
  } else {
    await pool.query("UPDATE meetings SET status='rejected' WHERE id=$1", [approval.meeting_id]);
  }
  res.redirect(`${process.env.FRONTEND_URL}/approval-action?result=${dbAction}`);
});

// POST /api/validateQR
router.post('/validateQR', authenticate, authorize('security'), async (req, res) => {
  const { token } = req.body;
  try {
    let parsed;
    try { parsed = JSON.parse(token); } catch { parsed = null; }
    if (parsed?.type === 'exit') {
      const { rows } = await pool.query('SELECT m.*,v.* FROM meetings m JOIN visitors v ON v.id=m.visitor_id WHERE m.id=$1', [parsed.meeting_id]);
      return res.json({ valid: true, type: 'exit', meeting: rows[0] });
    }
    const { verifyEntryQR } = require('../services/qr');
    const payload = verifyEntryQR(token);
    const { rows } = await pool.query(
      `SELECT m.*,v.name as v_name,v.email as v_email,v.company,v.is_blacklisted,
              vl.status as log_status
       FROM meetings m
       JOIN visitors v ON v.id=m.visitor_id
       LEFT JOIN visit_logs vl ON vl.meeting_id=m.id
       WHERE m.id=$1 AND m.visitor_id=$2`,
      [payload.m, payload.v]
    );
    const meeting = rows[0];
    if (!meeting) return res.json({ valid: false, reason: 'Meeting not found' });
    if (meeting.is_blacklisted) return res.json({ valid: false, reason: 'Visitor is blacklisted' });
    if (meeting.status !== 'accepted') return res.json({ valid: false, reason: 'Invite not accepted' });
    if (meeting.log_status === 'inside') return res.json({ valid: false, reason: 'Already inside' });
    const now = new Date();
    const start = new Date(meeting.scheduled_start);
    if (now < new Date(start.getTime() - 4 * 60 * 60 * 1000)) return res.json({ valid: false, reason: 'Too early (>4 hours)' });
    res.json({ valid: true, type: 'entry', meeting });
  } catch (err) {
    res.json({ valid: false, reason: 'Invalid or expired QR' });
  }
});

// POST /api/scanQR - record entry via QR
router.post('/scanQR', authenticate, authorize('security'), async (req, res) => {
  const { token } = req.body || {};
  const { verifyEntryQR } = require('../services/qr');
  let payload;
  try { payload = verifyEntryQR(token); } catch { return res.status(400).json({ error: 'Invalid QR' }); }

  try {
  const { rows } = await pool.query(
    `SELECT m.*,v.name,v.email,v.company,v.is_blacklisted,
            u.name as host_name,u.email as host_email
     FROM meetings m JOIN visitors v ON v.id=m.visitor_id JOIN users u ON u.id=m.host_id
     WHERE m.id=$1 AND m.visitor_id=$2`,
    [payload.m, payload.v]
  );
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'Not found' });
  if (meeting.is_blacklisted) return res.status(403).json({ error: 'Blacklisted' });
  if (meeting.status !== 'accepted') return res.status(400).json({ error: 'Not accepted' });
  if (meeting.scheduled_start && new Date(meeting.scheduled_start).getTime() > Date.now() + 4 * 60 * 60 * 1000)
    return res.status(400).json({ error: 'Visit is not open for check-in yet' });
  if (meeting.scheduled_end && new Date(meeting.scheduled_end).getTime() < Date.now())
    return res.status(410).json({ error: 'Visit has ended' });

  const { rows: logRows } = await pool.query(
    'SELECT * FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1', [payload.m]
  );
  if (logRows[0]?.status === 'inside') return res.status(400).json({ error: 'Already inside' });
  if (logRows[0]?.status === 'exited') return res.status(400).json({ error: 'Visit already completed' });

  if (logRows.length === 0) {
    await pool.query(
      'INSERT INTO visit_logs (meeting_id,visitor_id,status,entry_time,entry_by) VALUES ($1,$2,$3,NOW(),$4)',
      [payload.m, payload.v, 'inside', req.user.id]
    );
  } else {
    await pool.query(
      "UPDATE visit_logs SET status='inside', entry_time=NOW(), entry_by=$1 WHERE meeting_id=$2",
      [req.user.id, payload.m]
    );
  }
  await pool.query(
    'INSERT INTO security_logs (officer_id,action,meeting_id,visitor_id) VALUES ($1,$2,$3,$4)',
    [req.user.id, 'entry_scan', payload.m, payload.v]
  );

  const visitor = { name: meeting.name, email: meeting.email, company: meeting.company };
  await safeMail(() => sendCheckinConfirmation(visitor, meeting));
  await sendSlackNotification(`✅ ${visitor.name} checked in to meet ${meeting.host_name}`).catch(() => {});

  scheduleExitQR(meeting.id, visitor, meeting);

  res.json({ success: true, visitor, meeting });
  } catch (err) {
    console.error('QR check-in error:', err);
    res.status(500).json({ error: 'Unable to record entry right now' });
  }
});

// POST /api/verifyOTP - record entry via OTP fallback
router.post('/verifyOTP', authenticate, authorize('security'), async (req, res) => {
  const { otp } = req.body || {};
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim()))
    return res.status(400).json({ error: 'Invalid or expired OTP' });

  let client;
  let inTransaction = false;
  let meeting;
  let alreadyInside = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;

    // Lock the meeting while checking and consuming its OTP. Selecting visitor
    // fields explicitly prevents v.id from overwriting the meeting's id.
    const { rows } = await client.query(
      `SELECT m.*,v.name,v.email,v.company,v.is_blacklisted,u.name as host_name
       FROM meetings m
       JOIN visitors v ON v.id=m.visitor_id
       JOIN users u ON u.id=m.host_id
       WHERE m.entry_otp=$1 AND m.entry_otp_expires > NOW()
       ORDER BY m.id DESC LIMIT 1 FOR UPDATE OF m`,
      [otp.trim()]
    );
    meeting = rows[0];

    const reject = async (status, error) => {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(status).json({ error });
    };
    if (!meeting) return await reject(400, 'Invalid or expired OTP');
    if (meeting.is_blacklisted) return await reject(403, 'Visitor is blacklisted');
    if (meeting.status !== 'accepted') return await reject(400, 'Invite is no longer active');
    if (meeting.scheduled_start && new Date(meeting.scheduled_start).getTime() > Date.now() + 4 * 60 * 60 * 1000)
      return await reject(400, 'Visit is not open for check-in yet');
    if (meeting.scheduled_end && new Date(meeting.scheduled_end).getTime() < Date.now())
      return await reject(410, 'OTP has expired because the visit has ended');

    const { rows: logRows } = await client.query(
      'SELECT id, status FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1',
      [meeting.id]
    );
    if (logRows[0]?.status === 'exited') return await reject(400, 'Visit already completed');
    alreadyInside = logRows[0]?.status === 'inside';

    if (!alreadyInside) {
      if (logRows.length === 0) {
        await client.query(
          "INSERT INTO visit_logs (meeting_id,visitor_id,status,entry_time,entry_by) VALUES ($1,$2,'inside',NOW(),$3)",
          [meeting.id, meeting.visitor_id, req.user.id]
        );
      } else {
        await client.query(
          "UPDATE visit_logs SET status='inside', entry_time=NOW(), entry_by=$1 WHERE id=$2",
          [req.user.id, logRows[0].id]
        );
      }
      await client.query(
        'INSERT INTO security_logs (officer_id,action,meeting_id,visitor_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'otp_entry', meeting.id, meeting.visitor_id]
      );
    }
    await client.query('UPDATE meetings SET entry_otp=NULL, entry_otp_expires=NULL WHERE id=$1', [meeting.id]);
    await client.query('COMMIT');
    inTransaction = false;
  } catch (err) {
    if (inTransaction) {
      try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('OTP rollback error:', rollbackErr); }
    }
    console.error('OTP check-in error:', err);
    return res.status(500).json({ error: 'Unable to verify OTP right now' });
  } finally {
    if (client) client.release();
  }

  const visitor = { name: meeting.name, email: meeting.email, company: meeting.company };
  if (alreadyInside) return res.json({ success: true, visitor, meeting });
  await safeMail(() => sendCheckinConfirmation(visitor, meeting));
  await sendSlackNotification(`✅ ${visitor.name} checked in via OTP to meet ${meeting.host_name}`).catch(() => {});

  scheduleExitQR(meeting.id, visitor, meeting);

  res.json({ success: true, visitor, meeting });
});

// POST /api/manualCheckout - security manually checks out a visitor by meeting_id
router.post('/manualCheckout', authenticate, authorize('security', 'admin', 'hr_admin'), async (req, res) => {
  const { meeting_id } = req.body;
  if (!meeting_id) return res.status(400).json({ error: 'meeting_id is required' });

  const { rows } = await pool.query(
    `SELECT m.*,v.* FROM meetings m JOIN visitors v ON v.id=m.visitor_id WHERE m.id=$1`,
    [meeting_id]
  );
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  const { rows: logRows } = await pool.query(
    'SELECT status FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1', [meeting_id]
  );
  if (logRows[0]?.status === 'exited') return res.status(400).json({ error: 'Already checked out' });
  if (logRows[0]?.status !== 'inside') return res.status(400).json({ error: 'Visitor is not inside' });

  await pool.query(
    "UPDATE visit_logs SET status='exited', exit_time=NOW(), exit_by=$1 WHERE meeting_id=$2",
    [req.user.id, meeting_id]
  );
  await pool.query("UPDATE meetings SET status='completed' WHERE id=$1", [meeting_id]);
  await pool.query(
    'INSERT INTO security_logs (officer_id,action,meeting_id,visitor_id) VALUES ($1,$2,$3,$4)',
    [req.user.id, 'manual_checkout', meeting_id, meeting.visitor_id]
  );

  const visitor = { name: meeting.name, email: meeting.email };
  await safeMail(() => sendGoodbyeEmail(visitor, meeting));
  await sendSlackNotification(`👋 ${visitor.name} manually checked out by security`).catch(() => {});
  res.json({ success: true, visitor, meeting });
});

// POST /api/visitorExit
router.post('/visitorExit', authenticate, authorize('security'), async (req, res) => {
  const { token } = req.body;
  let parsed;
  try { parsed = JSON.parse(token); } catch { return res.status(400).json({ error: 'Invalid exit QR' }); }
  if (parsed.type !== 'exit') return res.status(400).json({ error: 'Not an exit QR' });

  const { rows } = await pool.query(
    `SELECT m.*,v.* FROM meetings m JOIN visitors v ON v.id=m.visitor_id WHERE m.id=$1`,
    [parsed.meeting_id]
  );
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'Not found' });

  const { rows: logRows } = await pool.query(
    'SELECT status FROM visit_logs WHERE meeting_id=$1 ORDER BY id DESC LIMIT 1', [parsed.meeting_id]
  );
  if (logRows[0]?.status === 'exited') return res.status(400).json({ error: 'Already exited' });
  if (logRows[0]?.status !== 'inside') return res.status(400).json({ error: 'Visitor is not inside' });
  await pool.query(
    "UPDATE visit_logs SET status='exited', exit_time=NOW(), exit_by=$1 WHERE meeting_id=$2",
    [req.user.id, parsed.meeting_id]
  );
  await pool.query("UPDATE meetings SET status='completed' WHERE id=$1", [parsed.meeting_id]);
  await pool.query(
    'INSERT INTO security_logs (officer_id,action,meeting_id,visitor_id) VALUES ($1,$2,$3,$4)',
    [req.user.id, 'exit_scan', parsed.meeting_id, meeting.visitor_id]
  );

  const visitor = { name: meeting.name, email: meeting.email };
  await safeMail(() => sendGoodbyeEmail(visitor, meeting));
  await sendSlackNotification(`👋 ${visitor.name} has exited`).catch(() => {});
  res.json({ success: true });
});

// POST /api/walkinVisitor
router.post('/walkinVisitor', authenticate, authorize('security'), async (req, res) => {
  const { name, phone, company, purpose, host_id } = req.body;
  const email = `walkin_${Date.now()}@temp.com`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: vRows } = await client.query(
      'INSERT INTO visitors (name,email,phone,company) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, phone, company]
    );
    const visitor = vRows[0];
    const { rows: mRows } = await client.query(
      `INSERT INTO meetings (visitor_id,host_id,purpose,scheduled_start,scheduled_end,status,is_walkin,created_by)
       VALUES ($1,$2,$3,NOW(),NOW()+'1 hour'::interval,'pending',TRUE,$4) RETURNING *`,
      [visitor.id, host_id, purpose, req.user.id]
    );
    const meeting = mRows[0];
    await client.query('INSERT INTO visit_logs (meeting_id,visitor_id,status) VALUES ($1,$2,$3)', [meeting.id, visitor.id, 'pending']);
    await client.query('COMMIT');

    const approvers = await pool.query("SELECT * FROM users WHERE role IN ('admin','hr_admin','host') AND id=$1", [host_id]);
    for (const approver of approvers.rows) {
      const approveToken = uuidv4();
      const rejectToken = uuidv4();
      await pool.query('INSERT INTO approvals (meeting_id,approver_id,action,approve_token,reject_token) VALUES ($1,$2,$3,$4,$5)', [meeting.id, approver.id, 'pending', approveToken, rejectToken]);
      await sendApprovalEmail(approver, visitor, meeting, approveToken, rejectToken);
    }
    res.json({ meeting, visitor });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/overrideApproval/:meeting_id
router.post('/overrideApproval/:meeting_id', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { action } = req.body;
  const { rows } = await pool.query('SELECT * FROM meetings WHERE id=$1', [req.params.meeting_id]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'Not found' });
  if (meeting.created_by === req.user.id) return res.status(403).json({ error: 'Cannot override own meeting' });

  if (action === 'approve') {
    const { qrToken, otp } = await acceptMeeting(meeting.id, meeting.visitor_id, meeting.scheduled_end);
    const { rows: vRows } = await pool.query('SELECT * FROM visitors WHERE id=$1', [meeting.visitor_id]);
    await safeMail(
      () => sendConfirmationWithQR(vRows[0], meeting, qrToken, otp),
      { meetingId: meeting.id, type: 'visit_confirmation' }
    );
  } else {
    await pool.query("UPDATE meetings SET status='rejected' WHERE id=$1", [meeting.id]);
  }
  res.json({ success: true });
});

// POST /api/blacklist/:visitor_id
router.post('/blacklist/:visitor_id', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  const { reason } = req.body;
  await pool.query('UPDATE visitors SET is_blacklisted=TRUE, blacklist_reason=$1 WHERE id=$2', [reason, req.params.visitor_id]);
  res.json({ success: true });
});

// DELETE /api/blacklist/:visitor_id
router.delete('/blacklist/:visitor_id', authenticate, authorize('admin', 'hr_admin'), async (req, res) => {
  await pool.query('UPDATE visitors SET is_blacklisted=FALSE, blacklist_reason=NULL WHERE id=$1', [req.params.visitor_id]);
  res.json({ success: true });
});

module.exports = router;
