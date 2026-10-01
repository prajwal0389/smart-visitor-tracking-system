const cron = require('node-cron');
const pool = require('../db/pool');
const { sendReminderEmail } = require('../services/email');

async function archiveOldMeetings(db = pool) {
  const { rows } = await db.query(
    `INSERT INTO visitor_archive (original_meeting_id, visitor_data, meeting_data, log_data)
     SELECT m.id, to_jsonb(v), to_jsonb(m),
            COALESCE((SELECT jsonb_agg(to_jsonb(vl) ORDER BY vl.id)
                      FROM visit_logs vl WHERE vl.meeting_id=m.id), '[]'::jsonb)
     FROM meetings m
     JOIN visitors v ON v.id=m.visitor_id
     WHERE m.scheduled_start < NOW() - INTERVAL '24 hours'
       AND m.status IN ('completed','rejected','cancelled')
       AND NOT EXISTS (
         SELECT 1 FROM visitor_archive a WHERE a.original_meeting_id=m.id
       )
     RETURNING original_meeting_id`
  );
  return rows.length;
}

function startJobs() {
  // Every minute: send reminder 30 min before accepted meetings
  cron.schedule('* * * * *', async () => {
    try {
      const { rows } = await pool.query(
        `SELECT m.*,v.name as v_name,v.email as v_email,u.name as host_name
         FROM meetings m JOIN visitors v ON v.id=m.visitor_id JOIN users u ON u.id=m.host_id
         WHERE m.status='accepted'
           AND m.scheduled_start BETWEEN NOW() + INTERVAL '29 minutes' AND NOW() + INTERVAL '31 minutes'`
      );
      for (const m of rows) {
        await sendReminderEmail({ name: m.v_name, email: m.v_email }, m, { name: m.host_name });
      }
    } catch (err) {
      console.error('Reminder cron error:', err.message);
    }
  });

  // Every 5 minutes: snapshot old meetings without removing referenced history.
  cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await archiveOldMeetings();
      if (count) console.log(`Archived ${count} meetings`);
    } catch (err) {
      console.error('Archive cron error:', err.message);
    }
  });

  console.log('Cron jobs started');
}

module.exports = { startJobs, archiveOldMeetings };
