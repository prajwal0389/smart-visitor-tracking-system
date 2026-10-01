const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const { archiveOldMeetings } = require('../src/jobs/cron');

test('archiving snapshots a completed meeting without removing its references', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unique = `${Date.now()}-${Math.random()}`;
    const user = await client.query(
      "INSERT INTO users (name,email,role) VALUES ('Archive test host',$1,'host') RETURNING id",
      [`archive-host-${unique}@example.invalid`]
    );
    const visitor = await client.query(
      "INSERT INTO visitors (name,email) VALUES ('Archive test visitor',$1) RETURNING id",
      [`archive-visitor-${unique}@example.invalid`]
    );
    const meeting = await client.query(
      `INSERT INTO meetings (visitor_id,host_id,status,scheduled_start,scheduled_end)
       VALUES ($1,$2,'completed',NOW() - INTERVAL '3 days',NOW() - INTERVAL '3 days' + INTERVAL '1 hour')
       RETURNING id`,
      [visitor.rows[0].id, user.rows[0].id]
    );
    const meetingId = meeting.rows[0].id;
    const log = await client.query(
      "INSERT INTO visit_logs (meeting_id,visitor_id,status) VALUES ($1,$2,'exited') RETURNING id",
      [meetingId, visitor.rows[0].id]
    );
    await client.query(
      'INSERT INTO feedback (meeting_id,visitor_id,rating) VALUES ($1,$2,5)',
      [meetingId, visitor.rows[0].id]
    );

    await archiveOldMeetings(client);
    const archive = await client.query(
      'SELECT meeting_data,visitor_data,log_data FROM visitor_archive WHERE original_meeting_id=$1',
      [meetingId]
    );
    assert.equal(archive.rowCount, 1);
    assert.equal(archive.rows[0].meeting_data.id, meetingId);
    assert.equal(archive.rows[0].visitor_data.id, visitor.rows[0].id);
    assert.equal(archive.rows[0].log_data[0].id, log.rows[0].id);
    assert.equal((await client.query('SELECT 1 FROM meetings WHERE id=$1', [meetingId])).rowCount, 1);
    assert.equal((await client.query('SELECT 1 FROM visit_logs WHERE meeting_id=$1', [meetingId])).rowCount, 1);
    assert.equal((await client.query('SELECT 1 FROM feedback WHERE meeting_id=$1', [meetingId])).rowCount, 1);

    await archiveOldMeetings(client);
    assert.equal((await client.query(
      'SELECT 1 FROM visitor_archive WHERE original_meeting_id=$1', [meetingId]
    )).rowCount, 1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
