-- Users (admin, hr_admin, host, security)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin','hr_admin','host','security')),
  google_id VARCHAR(255),
  otp VARCHAR(10),
  otp_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visitors
CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255),
  photo_url VARCHAR(500),
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER REFERENCES visitors(id),
  host_id INTEGER REFERENCES users(id),
  purpose TEXT,
  visit_type VARCHAR(100),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled','completed')),
  invite_token VARCHAR(500),
  qr_token VARCHAR(500),
  exit_qr_token VARCHAR(500),
  entry_otp VARCHAR(10),
  entry_otp_expires TIMESTAMPTZ,
  is_walkin BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
  approver_id INTEGER REFERENCES users(id),
  action VARCHAR(50) CHECK (action IN ('approved','rejected','pending')),
  approve_token VARCHAR(500) UNIQUE,
  reject_token VARCHAR(500) UNIQUE,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate old token column if exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approvals' AND column_name='token') THEN
    ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approve_token VARCHAR(500) UNIQUE;
    ALTER TABLE approvals ADD COLUMN IF NOT EXISTS reject_token VARCHAR(500) UNIQUE;
    ALTER TABLE approvals DROP COLUMN IF EXISTS token;
  END IF;
END $$;

-- Visit Logs
CREATE TABLE IF NOT EXISTS visit_logs (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES meetings(id),
  visitor_id INTEGER REFERENCES visitors(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','inside','exited','denied')),
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  entry_by INTEGER REFERENCES users(id),
  exit_by INTEGER REFERENCES users(id),
  exit_qr_sent BOOLEAN DEFAULT FALSE,
  exit_qr_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES meetings(id),
  visitor_id INTEGER REFERENCES visitors(id),
  checkpoint_name VARCHAR(255),
  scanned_by INTEGER REFERENCES users(id),
  scan_time TIMESTAMPTZ DEFAULT NOW(),
  action VARCHAR(50)
);

-- Approval Rules
CREATE TABLE IF NOT EXISTS approval_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  priority INTEGER NOT NULL,
  conditions JSONB NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('APPROVED','REJECTED','REQUIRE_APPROVAL')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visitor Archive
CREATE TABLE IF NOT EXISTS visitor_archive (
  id SERIAL PRIMARY KEY,
  original_meeting_id INTEGER,
  visitor_data JSONB,
  meeting_data JSONB,
  log_data JSONB,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Host Activity Logs
CREATE TABLE IF NOT EXISTS host_activity_logs (
  id SERIAL PRIMARY KEY,
  host_id INTEGER REFERENCES users(id),
  action VARCHAR(255),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Logs
CREATE TABLE IF NOT EXISTS security_logs (
  id SERIAL PRIMARY KEY,
  officer_id INTEGER REFERENCES users(id),
  action VARCHAR(255),
  meeting_id INTEGER,
  visitor_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES meetings(id),
  visitor_id INTEGER REFERENCES visitors(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_visitor ON meetings(visitor_id);
CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_visit_logs_meeting ON visit_logs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_status ON visit_logs(status);
CREATE INDEX IF NOT EXISTS idx_visitors_email ON visitors(email);

-- Migrate: add OTP columns if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='entry_otp') THEN
    ALTER TABLE meetings ADD COLUMN entry_otp VARCHAR(10);
    ALTER TABLE meetings ADD COLUMN entry_otp_expires TIMESTAMPTZ;
  END IF;
END $$;

-- User Requests (HR submits, admin approves)
CREATE TABLE IF NOT EXISTS user_requests (
  id SERIAL PRIMARY KEY,
  requested_by INTEGER REFERENCES users(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('add','edit','delete')),
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
