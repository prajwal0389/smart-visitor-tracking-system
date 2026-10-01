const axios = require('axios');
require('dotenv').config();

async function sendSlackNotification(message) {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
  } catch (err) {
    console.error('Slack notification failed:', err.message);
  }
}

module.exports = { sendSlackNotification };
