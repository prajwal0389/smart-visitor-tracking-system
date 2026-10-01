const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

async function sendMail(to, subject, html, attachments = []) {
  if (!to || to.startsWith('walkin_')) return { skipped: true };
  try {
    return await transporter.sendMail({
      from: `"VMS System" <${process.env.GMAIL_USER}>`,
      to, subject, html, attachments
    });
  } catch (err) {
    err.smtpAttempted = true;
    throw err;
  }
}

async function qrToBase64(data) {
  return QRCode.toDataURL(data, { width: 300, margin: 2 });
}

async function sendInviteEmail(visitor, meeting, host, token) {
  const acceptUrl = `${process.env.APP_URL}/api/acceptInvite/${token}`;
  const declineUrl = `${process.env.APP_URL}/api/declineInvite/${token}`;
  const html = `
    <h2>You have been invited to visit ${host.name}</h2>
    <p><b>Date:</b> ${new Date(meeting.scheduled_start).toLocaleString()}</p>
    <p><b>Purpose:</b> ${meeting.purpose}</p>
    <p>
      <a href="${acceptUrl}" style="background:#22c55e;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;margin-right:10px">Accept</a>
      <a href="${declineUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px">Decline</a>
    </p>`;
  return sendMail(visitor.email, 'Visitor Invitation', html);
}

async function sendConfirmationWithQR(visitor, meeting, qrData, otp) {
  const qrImage = await qrToBase64(qrData);
  const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
  const html = `
    <h2>Your visit is confirmed!</h2>
    <p><b>Date:</b> ${new Date(meeting.scheduled_start).toLocaleString()}</p>
    <p>Please show the QR code below at the entrance.</p>
    <img src="cid:qrcode" alt="QR Code" style="width:200px"/>
    ${otp ? `<p style="margin-top:16px">If the QR code cannot be scanned, use this code at the security desk:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#6366f1">${otp}</p>` : ''}`;
  return sendMail(visitor.email, 'Visit Confirmation - QR Pass', html, [{
    filename: 'qr-pass.png',
    content: base64Data,
    encoding: 'base64',
    cid: 'qrcode'
  }]);
}

async function sendApprovalEmail(approver, visitor, meeting, approveToken, rejectToken) {
  const approveUrl = `${process.env.APP_URL}/api/approvalAction/${approveToken}/approve`;
  const rejectUrl = `${process.env.APP_URL}/api/approvalAction/${rejectToken}/reject`;
  const html = `
    <h2>Approval Required</h2>
    <p><b>Visitor:</b> ${visitor.name} (${visitor.company || 'N/A'})</p>
    <p><b>Meeting:</b> ${new Date(meeting.scheduled_start).toLocaleString()}</p>
    <p><b>Purpose:</b> ${meeting.purpose}</p>
    <p>
      <a href="${approveUrl}" style="background:#22c55e;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;margin-right:10px">Approve</a>
      <a href="${rejectUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px">Reject</a>
    </p>`;
  return sendMail(approver.email, 'Visitor Approval Required', html);
}

async function sendCheckinConfirmation(visitor, meeting) {
  const html = `<h2>You have checked in!</h2><p>Welcome! Your visit has been recorded at ${new Date().toLocaleString()}.</p>`;
  return sendMail(visitor.email, 'Check-in Confirmation', html);
}

async function sendExitQRPass(visitor, meeting, exitQrData) {
  const qrImage = await qrToBase64(exitQrData);
  const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
  const html = `
    <h2>Welcome! Please use this QR to exit</h2>
    <p>Show this QR code to security when you leave.</p>
    <img src="cid:exitqr" alt="Exit QR" style="width:200px"/>`;
  return sendMail(visitor.email, 'Exit QR Pass', html, [{
    filename: 'exit-qr.png',
    content: base64Data,
    encoding: 'base64',
    cid: 'exitqr'
  }]);
}

async function sendGoodbyeEmail(visitor, meeting) {
  const jwt = require('jsonwebtoken');
  const feedbackToken = jwt.sign(
    { meeting_id: meeting.id, visitor_id: meeting.visitor_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const feedbackUrl = `${process.env.FRONTEND_URL}/feedback/${meeting.id}?token=${feedbackToken}`;
  const html = `
    <h2>Thank you for your visit!</h2>
    <p>We hope your visit was pleasant. Please take a moment to share your feedback.</p>
    <a href="${feedbackUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px">Give Feedback</a>`;
  return sendMail(visitor.email, 'Thank you for visiting!', html);
}

async function sendReminderEmail(visitor, meeting, host) {
  const html = `<h2>Reminder: Your visit is in 30 minutes</h2><p>You have a scheduled visit with ${host.name} at ${new Date(meeting.scheduled_start).toLocaleString()}.</p>`;
  return sendMail(visitor.email, 'Visit Reminder - 30 Minutes', html);
}

async function sendOTPEmail(email, otp) {
  const html = `<h2>Your OTP</h2><p>Your login OTP is: <b style="font-size:24px">${otp}</b></p><p>Valid for 10 minutes.</p>`;
  return sendMail(email, 'Login OTP', html);
}

module.exports = {
  sendInviteEmail, sendConfirmationWithQR, sendApprovalEmail,
  sendCheckinConfirmation, sendExitQRPass, sendGoodbyeEmail,
  sendReminderEmail, sendOTPEmail, sendMail
};
