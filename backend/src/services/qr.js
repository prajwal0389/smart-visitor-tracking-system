const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

function generateEntryQR(visitorId, meetingId, expiresAt) {
  const nonce = uuidv4();
  const exp = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const token = jwt.sign(
    { v: visitorId, m: meetingId, s: nonce, exp },
    process.env.JWT_QR_SECRET
  );
  return token;
}

function generateEntryOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateExitQR(meetingId) {
  return JSON.stringify({ meeting_id: meetingId, type: 'exit' });
}

function verifyEntryQR(token) {
  return jwt.verify(token, process.env.JWT_QR_SECRET);
}

module.exports = { generateEntryQR, generateEntryOTP, generateExitQR, verifyEntryQR };
