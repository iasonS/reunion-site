// In-process tests for the read-only organizer page (/organizers/:token).
// Uses a throwaway SQLite DB and a test token — safe to run anywhere.
// Usage: node --test organizers.test.js

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Must be set before requiring server.js / db.js
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reunion-test-'));
const TOKEN = 'a'.repeat(32);
process.env.ORGANIZER_TOKEN = TOKEN;

const { app } = require('./server');
const db = require('./db');

const SEEDED_EMAIL = 'secret.email@example.com';

let server;
let baseUrl;

before(async () => {
  db.insert({ name: 'Test Attendee', email: SEEDED_EMAIL, attending: 'yes', notes: 'bringing a plus one' });
  await new Promise(resolve => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

describe('GET /organizers/:token', () => {

  it('returns the RSVP list for a valid token', async () => {
    const res = await fetch(`${baseUrl}/organizers/${TOKEN}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Test Attendee'), 'should list attendee names');
    assert.ok(html.includes('bringing a plus one'), 'should show notes');
  });

  it('never exposes email addresses', async () => {
    const res = await fetch(`${baseUrl}/organizers/${TOKEN}`);
    const html = await res.text();
    assert.ok(!html.includes(SEEDED_EMAIL), 'seeded email must not appear');
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(html), 'no email-shaped string may appear');
  });

  it('is not indexable by search engines', async () => {
    const res = await fetch(`${baseUrl}/organizers/${TOKEN}`);
    assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex');
    const html = await res.text();
    assert.ok(html.includes('name="robots" content="noindex"'), 'should have noindex meta tag');
  });

  it('returns 404 for a wrong token', async () => {
    const res = await fetch(`${baseUrl}/organizers/${'b'.repeat(32)}`);
    assert.strictEqual(res.status, 404);
  });

  it('returns 404 for a token with different length', async () => {
    const res = await fetch(`${baseUrl}/organizers/short`);
    assert.strictEqual(res.status, 404);
  });

  it('returns 404 without a token', async () => {
    for (const p of ['/organizers', '/organizers/']) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.strictEqual(res.status, 404, `${p} should 404`);
    }
  });

  it('returns 404 for everything when ORGANIZER_TOKEN is unset', async () => {
    delete process.env.ORGANIZER_TOKEN;
    try {
      const res = await fetch(`${baseUrl}/organizers/${TOKEN}`);
      assert.strictEqual(res.status, 404);
    } finally {
      process.env.ORGANIZER_TOKEN = TOKEN;
    }
  });
});
