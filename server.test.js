// Smoke tests — run against prod (or a local build) to verify deployment won't break.
// Usage: SITE_URL=https://acsathens2016grads.com node --test server.test.js
//   or:  SITE_URL=http://localhost:3000 node --test server.test.js

const { describe, it } = require('node:test');
const assert = require('node:assert');

const SITE_URL = process.env.SITE_URL || 'https://acsathens2016grads.com';

async function get(path) {
  return fetch(`${SITE_URL}${path}`);
}

async function post(path, body) {
  return fetch(`${SITE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

describe(`Smoke tests against ${SITE_URL}`, () => {

  it('GET /health returns ok', async () => {
    const res = await get('/health');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { ok: true });
  });

  it('GET / returns the main page', async () => {
    const res = await get('/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Class of 2016'), 'Main page should contain "Class of 2016"');
    assert.ok(html.includes('name="name"'), 'Main page should contain the RSVP form');
  });

  it('GET / includes honeypot field', async () => {
    const res = await get('/');
    const html = await res.text();
    assert.ok(html.includes('name="website"'), 'Main page should contain honeypot field');
  });

  it('GET /contact.html loads', async () => {
    const res = await get('/contact.html');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Get in Touch'), 'Contact page should load');
  });

  it('GET /style.css loads', async () => {
    const res = await get('/style.css');
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct.includes('css'), 'Should serve CSS');
  });

  it('POST /rsvp rejects missing fields', async () => {
    const res = await post('/rsvp', { name: 'SmokeTest' });
    assert.strictEqual(res.status, 400);
  });

  it('POST /rsvp rejects invalid attending value', async () => {
    const res = await post('/rsvp', {
      name: 'SmokeTest',
      email: 'smoke@test.dev',
      attending: 'invalid',
    });
    assert.strictEqual(res.status, 400);
  });

  it('POST /rsvp silently blocks honeypot spam', async () => {
    const res = await post('/rsvp', {
      name: 'SmokeTestBot',
      email: 'bot@test.dev',
      attending: 'yes',
      website: 'http://spam.com',
    });
    // Should redirect (fake success) but not save
    assert.strictEqual(res.status, 302);
  });

  it('POST /rsvp silently blocks URL-in-notes spam', async () => {
    const res = await post('/rsvp', {
      name: 'SmokeTestBot2',
      email: 'bot2@test.dev',
      attending: 'yes',
      notes: 'Visit https://t.me/spammer',
    });
    assert.strictEqual(res.status, 302);
  });

  it('POST /contact rejects missing fields', async () => {
    const res = await post('/contact', { name: 'SmokeTest' });
    assert.strictEqual(res.status, 400);
  });

  it('POST /contact silently blocks honeypot spam', async () => {
    const res = await post('/contact', {
      name: 'SmokeBot',
      email: 'bot@test.dev',
      message: 'Buy my stuff',
      website: 'filled-by-bot',
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
  });

  it('GET /admin requires auth', async () => {
    const res = await get('/admin');
    assert.strictEqual(res.status, 401);
  });
});
