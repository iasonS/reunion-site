const cron = require('node-cron');
const db = require('./db');

const EVENT_DATE = '24th July 2026';
const EVENT_TIME = '9:00 PM — 12:00 AM';
const EVENT_VENUE = 'Cocomat Hotel Rooftop, Kolonaki';

function reminderHtml(name, timeframe) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #2c2c2c;">
      <div style="background: #1a1a1a; padding: 2.5rem 2rem; text-align: center; border-radius: 10px 10px 0 0;">
        <p style="color: #d4af5a; font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 1rem;">Reminder</p>
        <h1 style="color: white; font-family: Georgia, serif; font-size: 2rem; font-weight: 300; margin: 0 0 0.5rem;">Class of 2016</h1>
        <p style="color: rgba(255,255,255,0.6); font-style: italic; margin: 0;">ACS Athens — 10 Year Reunion</p>
      </div>
      <div style="padding: 2rem; background: #fdfaf5; border: 1px solid #e8e0d0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 1rem; line-height: 1.6; margin: 0 0 1.5rem;">
          Hi ${name},
        </p>
        <p style="font-size: 1rem; line-height: 1.6; margin: 0 0 1.5rem;">
          Just a friendly reminder — our reunion is <strong>${timeframe}</strong>!
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 1.5rem;">
          <tr>
            <td style="padding: 0.5rem 0; color: #b8962e; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; width: 70px;">Date</td>
            <td style="padding: 0.5rem 0;">${EVENT_DATE}</td>
          </tr>
          <tr>
            <td style="padding: 0.5rem 0; color: #b8962e; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase;">Time</td>
            <td style="padding: 0.5rem 0;">${EVENT_TIME}</td>
          </tr>
          <tr>
            <td style="padding: 0.5rem 0; color: #b8962e; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase;">Venue</td>
            <td style="padding: 0.5rem 0;">${EVENT_VENUE}</td>
          </tr>
        </table>
        <p style="font-size: 0.9rem; line-height: 1.6; color: #666; margin: 0;">
          We can't wait to see you there. If your plans have changed, you can update your RSVP on the site.
        </p>
      </div>
    </div>
  `;
}

async function sendReminders(mailer, timeframe) {
  if (!mailer) {
    console.error('[reminders] Mailer not configured');
    return { sent: 0, failed: 0, error: 'Mailer not configured' };
  }

  const attendees = db.attendees();
  console.log(`[reminders] Sending "${timeframe}" reminder to ${attendees.length} attendees`);

  let sent = 0;
  let failed = 0;

  for (const { name, email } of attendees) {
    try {
      await mailer.sendMail({
        from: `"ACS Athens Class of 2016" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Reunion Reminder — ${timeframe}!`,
        html: reminderHtml(name, timeframe)
      });
      sent++;
      console.log(`[reminders] Sent to ${email}`);
    } catch (err) {
      failed++;
      console.error(`[reminders] Failed for ${email}: ${err.message}`);
    }
  }

  console.log(`[reminders] Done: ${sent} sent, ${failed} failed`);
  return { sent, failed, total: attendees.length };
}

function scheduleReminders(mailer) {
  // 1 month before: June 24, 2026 at 10:00 AM
  cron.schedule('0 10 24 6 *', () => {
    const now = new Date();
    if (now.getFullYear() === 2026) {
      console.log('[reminders] Triggering 1-month reminder');
      sendReminders(mailer, 'in one month');
    }
  }, { timezone: 'Europe/Athens' });

  // 1 week before: July 17, 2026 at 10:00 AM
  cron.schedule('0 10 17 7 *', () => {
    const now = new Date();
    if (now.getFullYear() === 2026) {
      console.log('[reminders] Triggering 1-week reminder');
      sendReminders(mailer, 'in one week');
    }
  }, { timezone: 'Europe/Athens' });

  console.log('[reminders] Scheduled: June 24 (1 month) + July 17 (1 week), 10:00 AM Athens time');
}

module.exports = { sendReminders, scheduleReminders };
