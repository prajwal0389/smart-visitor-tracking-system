const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = require('../src/db/pool');
const emailService = require('../src/services/email');
let mailResult;
const attemptedRecipients = [];
emailService.sendConfirmationWithQR = async visitor => {
  attemptedRecipients.push(visitor.email);
  if (mailResult instanceof Error) throw mailResult;
  return mailResult;
};
const visitors = require('../src/routes/visitors');

test('a repeat invitation auto-accepts and reports SMTP submission status', async () => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const queries = [];
  const visitor = { id: 5, name: 'Arjun Gowda', email: 'existing@example.invalid', is_blacklisted: false };
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT * FROM visitors')) return { rows: [visitor] };
      if (sql.startsWith('SELECT * FROM users')) return { rows: [{ id: 1, role: 'admin', name: 'Admin' }] };
      if (sql.startsWith('INSERT INTO meetings')) {
        return { rows: [{ id: 123, visitor_id: 5, scheduled_end: new Date(Date.now() + 3600000), status: 'pending' }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  pool.connect = async () => client;
  pool.query = async sql => {
    queries.push(sql);
    if (sql.startsWith('SELECT * FROM approval_rules')) return { rows: [] };
    return { rows: [], rowCount: 1 };
  };

  const app = express();
  app.use(express.json());
  app.use('/api', visitors);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
  const invite = async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/inviteVisitor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: visitor.name, email: visitor.email, scheduled_end: new Date(Date.now() + 3600000) }),
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    const blocked = new Error('Connection blocked');
    blocked.code = 'EACCES';
    blocked.smtpAttempted = true;
    mailResult = blocked;
    const failed = await invite();
    assert.equal(failed.status, 200);
    assert.equal(failed.body.meeting.status, 'accepted');
    assert.equal(failed.body.emailDelivery, 'failed');

    mailResult = { accepted: [visitor.email], rejected: [] };
    const accepted = await invite();
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.emailDelivery, 'smtp_accepted');
    assert.deepEqual(attemptedRecipients, [visitor.email, visitor.email]);
    assert.equal(queries.filter(sql => sql.startsWith('INSERT INTO visitors')).length, 0);
    assert.equal(queries.filter(sql => sql.startsWith('UPDATE meetings SET status')).length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.connect = originalConnect;
    pool.query = originalQuery;
  }
});
