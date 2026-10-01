const pool = require('../db/pool');

async function evaluateRules(visitor, meeting, host) {
  const { rows: rules } = await pool.query(
    'SELECT * FROM approval_rules WHERE is_active = TRUE ORDER BY priority ASC'
  );

  for (const rule of rules) {
    const cond = rule.conditions;
    let match = true;

    if (cond.blacklisted !== undefined && visitor.is_blacklisted !== cond.blacklisted) match = false;
    if (match && cond.company && visitor.company !== cond.company) match = false;
    if (match && cond.company_contains && !visitor.company?.toLowerCase().includes(cond.company_contains.toLowerCase())) match = false;
    if (match && cond.host_role && host.role !== cond.host_role) match = false;
    if (match && cond.visit_type && meeting.visit_type !== cond.visit_type) match = false;
    if (match && cond.purpose_contains && !meeting.purpose?.toLowerCase().includes(cond.purpose_contains.toLowerCase())) match = false;

    if (match && (cond.time_start || cond.time_end)) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      if (cond.time_start && hhmm < cond.time_start) match = false;
      if (cond.time_end && hhmm > cond.time_end) match = false;
    }

    if (match) return rule.action;
  }

  return 'REQUIRE_APPROVAL';
}

module.exports = { evaluateRules };
