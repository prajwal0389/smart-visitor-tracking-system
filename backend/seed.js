require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/db/pool');

async function seed() {
  const hash = await bcrypt.hash('password', 10);
  console.log('Hash:', hash);
  await pool.query('DELETE FROM users');
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
     ('Admin User',     'admin@vms.com',    $1, 'admin'),
     ('HR Admin',       'hr@vms.com',       $1, 'hr_admin'),
     ('Host User',      'host@vms.com',     $1, 'host'),
     ('Security Guard', 'security@vms.com', $1, 'security')`,
    [hash]
  );
  console.log('Seeded 4 users with password: password');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
