const express = require('express');
const basicAuth = require('basic-auth');
const nodemailer = require('nodemailer');
const db = require('./db');
const { sendReminders, scheduleReminders } = require('./reminders');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const mailer = process.env.SMTP_USER ? nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

async function alertError(req, err) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: `"Reunion Site" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL,
      subject: `🔴 Error on reunion site: ${req.method} ${req.path}`,
      text: `A user encountered a 500 error.\n\nMethod: ${req.method}\nPath: ${req.path}\nTime: ${new Date().toISOString()}\n\nError:\n${err.stack || err.message}`
    });
  } catch (e) {
    console.error('Failed to send error alert:', e.message);
  }
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin auth middleware
function requireAuth(req, res, next) {
  const creds = basicAuth(req);
  if (!creds || creds.name !== ADMIN_USER || creds.pass !== ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Unauthorized');
  }
  next();
}

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Spam detection helpers
const URL_PATTERN = /https?:\/\/|www\./i;

function isSpam(body) {
  // Honeypot: if the hidden "website" field is filled, it's a bot
  if (body.website) return 'honeypot';
  // URL in notes field: legit classmates won't post links
  if (body.notes && URL_PATTERN.test(body.notes)) return 'url_in_notes';
  return false;
}

// RSVP submission
app.post('/rsvp', (req, res) => {
  const { name, email, attending, notes } = req.body;

  if (!name || !email || !attending || !['yes', 'no', 'maybe'].includes(attending)) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  const spamReason = isSpam(req.body);
  if (spamReason) {
    console.log(`[spam] Blocked RSVP: reason=${spamReason}, name=${name}, email=${email}`);
    // Return success to not tip off the bot
    return res.redirect('/?rsvp=done');
  }

  try {
    db.insert({ name: name.trim(), email: email.trim(), attending, notes: notes?.trim() });
    res.redirect('/?rsvp=done');
  } catch (err) {
    console.error(err);
    alertError(req, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Contact form
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const spamReason = isSpam(req.body);
  if (spamReason) {
    console.log(`[spam] Blocked contact: reason=${spamReason}, name=${name}, email=${email}`);
    return res.json({ ok: true });
  }

  if (!mailer) {
    return res.status(500).json({ error: 'Mail not configured' });
  }

  try {
    await mailer.sendMail({
      from: `"Reunion Contact" <${process.env.SMTP_USER}>`,
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      to: process.env.ALERT_EMAIL,
      subject: `Reunion Contact: ${name.trim()}`,
      text: `From: ${name.trim()} <${email.trim()}>\n\nMessage:\n${message.trim()}`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact mail error:', err);
    alertError(req, err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// Admin: send reminder manually
app.post('/admin/reminder', requireAuth, async (req, res) => {
  const timeframe = req.body.timeframe || 'soon';
  const result = await sendReminders(mailer, timeframe);
  res.json(result);
});

// Admin view
app.get('/admin', requireAuth, (req, res) => {
  const rsvps = db.all();
  const counts = db.counts();

  const rows = rsvps.map(r => `
    <tr>
      <td>${r.created_at}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.email || '—')}</td>
      <td class="status-${r.attending}">${r.attending}</td>
      <td>${esc(r.notes || '—')}</td>
    </tr>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin — RSVPs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 2rem; background: #f9f9f9; color: #222; }
    h1 { margin-bottom: 1rem; font-size: 1.5rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .stat { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem 1.5rem; text-align: center; }
    .stat-num { font-size: 2rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #777; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 0.875rem; }
    th { background: #f5f5f5; font-weight: 600; color: #555; }
    .status-yes { color: #2d7d46; font-weight: 600; }
    .status-no { color: #c0392b; font-weight: 600; }
    .status-maybe { color: #d68910; font-weight: 600; }
    a.export { display: inline-block; margin-bottom: 1rem; color: #555; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>RSVPs — ACS Athens Class of 2016</h1>
  <div class="stats">
    <div class="stat"><div class="stat-num">${counts.total}</div><div class="stat-label">Total</div></div>
    <div class="stat"><div class="stat-num">${counts.yes}</div><div class="stat-label">Attending</div></div>
    <div class="stat"><div class="stat-num">${counts.maybe}</div><div class="stat-label">Maybe</div></div>
    <div class="stat"><div class="stat-num">${counts.no}</div><div class="stat-label">Not attending</div></div>
  </div>
  <a class="export" href="/admin/export">Download CSV</a>
  <table>
    <thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Attending</th><th>Notes</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">No RSVPs yet</td></tr>'}</tbody>
  </table>
</body>
</html>`);
});

// CSV export
app.get('/admin/export', requireAuth, (req, res) => {
  const rsvps = db.all();
  const header = 'Date,Name,Email,Attending,Notes\n';
  const rows = rsvps.map(r =>
    [r.created_at, r.name, r.email || '', r.attending, r.notes || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rsvps.csv"');
  res.send(header + rows);
});

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  alertError(req, err);
  res.status(500).send('Something went wrong.');
});

// Export for testing; start server only when run directly
module.exports = { app, isSpam };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Reunion site running on port ${PORT}`);
    scheduleReminders(mailer);

    if (process.env.TEST_REMINDER === '1') {
      console.log('[reminders] TEST MODE: sending test reminder in 60 seconds...');
      setTimeout(() => {
        sendReminders(mailer, 'a test — ignore this');
      }, 60000);
    }
  });
}
