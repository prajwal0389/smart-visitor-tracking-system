const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = require('../src/db/pool');
require('../src/services/email').sendCheckinConfirmation = async () => {};
require('../src/services/slack').sendSlackNotification = async () => {};
const visitors = require('../src/routes/visitors');

test('OTP check-in uses the meeting ID, rejects old codes, and survives database errors', async () => {
  const originalConnect = pool.connect;
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, delay, ...args) =>
    delay === 20 * 60 * 1000 ? { unref() {} } : originalSetTimeout(fn, delay, ...args);

  const queries = [];
  let consumed = false;
  const meeting = {
    id: 6,
    visitor_id: 5,
    status: 'accepted',
    name: 'Test visitor',
    email: 'visitor@example.invalid',
    company: 'Test',
    host_name: 'Test host',
    is_blacklisted: false,
    scheduled_start: new Date(Date.now() - 60 * 60 * 1000),
    scheduled_end: new Date(Date.now() + 60 * 60 * 1000),
  };
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('WHERE m.entry_otp')) {
        if (params[0] === '123456' && !consumed) return { rows: [meeting] };
        if (params[0] === '222222') {
          return { rows: [{ ...meeting, scheduled_end: new Date(Date.now() - 1000) }] };
        }
        return { rows: [] };
      }
      if (sql.startsWith('SELECT id, status FROM visit_logs')) {
        return { rows: [{ id: 17, status: 'pending' }] };
      }
      if (sql.startsWith('UPDATE meetings SET entry_otp=NULL')) consumed = true;
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  pool.connect = async () => client;

  const app = express();
  app.use(express.json());
  app.use('/api', visitors);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const token = jwt.sign({ id: 9, role: 'security' }, process.env.JWT_SECRET);
  const post = async otp => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/verifyOTP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp }),
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    const valid = await post('123456');
    assert.equal(valid.status, 200);
    assert.equal(valid.body.meeting.id, 6);
    assert.deepEqual(queries.find(q => q.sql.startsWith('UPDATE visit_logs')).params, [9, 17]);
    assert.deepEqual(queries.find(q => q.sql.startsWith('INSERT INTO security_logs')).params, [9, 'otp_entry', 6, 5]);
    assert.deepEqual(queries.find(q => q.sql.startsWith('UPDATE meetings SET entry_otp=NULL')).params, [6]);

    const reused = await post('123456');
    assert.equal(reused.status, 400);
    assert.match(reused.body.error, /Invalid or expired OTP/);

    const old = await post('222222');
    assert.equal(old.status, 410);
    assert.match(old.body.error, /visit has ended/);

    pool.connect = async () => { throw new Error('Database unavailable'); };
    const failed = await post('333333');
    assert.equal(failed.status, 500);
    assert.equal(failed.body.error, 'Unable to verify OTP right now');
    pool.connect = async () => client;
    assert.equal((await post('333333')).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.connect = originalConnect;
    global.setTimeout = originalSetTimeout;
  }
});
