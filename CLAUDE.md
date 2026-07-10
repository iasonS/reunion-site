# CLAUDE.md — reunion-site

## Overview

ACS Athens Class of 2016 — 10 Year Reunion RSVP website. Simple Node.js/Express app with SQLite database, served via Docker on tt-server behind Cloudflare tunnel.

**Repo**: `iasonS/reunion-site` (public)
**Domain**: acsathens2016grads.com
**Owner**: iasonS <sklavenitisi6@gmail.com>

## Architecture

```
reunion-site/
├── CLAUDE.md          # THIS FILE
├── server.js          # Express app: RSVP, contact, admin, reminders
├── db.js              # SQLite via better-sqlite3 (WAL mode)
├── reminders.js       # node-cron scheduled email reminders
├── package.json       # Dependencies: express, better-sqlite3, nodemailer, node-cron, basic-auth
├── Dockerfile         # node:20-alpine
├── .dockerignore
└── public/
    ├── index.html     # Main page: hero, RSVP form, footer
    ├── contact.html   # Contact form page (sends email to organiser)
    └── style.css      # All styles (dark hero, gold accents, responsive)
```

## Event Details

- **Date**: 24th July 2026
- **Time**: 9:00 PM — 12:00 AM
- **Venue**: Meropion Rooftop, Athens (address: 45 Dionysiou Areopagitou St)
- **RSVP deadline**: June 1st, 2026

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | — | Main page with RSVP form |
| GET | /contact.html | — | Contact form page |
| GET | /health | — | Health check (JSON) |
| POST | /rsvp | — | RSVP submission → redirect /?rsvp=done |
| POST | /contact | — | Contact form → sends email to ALERT_EMAIL |
| GET | /admin | Basic | Admin dashboard: RSVP table + stats |
| GET | /admin/export | Basic | CSV download of all RSVPs |
| POST | /admin/reminder | Basic | Manual reminder trigger (body: {"timeframe": "..."}) |
| GET | /organizers/:token | Secret URL | Read-only RSVP view for co-organizers: stats + name/attending/notes table. No emails, no export. Token checked (timing-safe) against ORGANIZER_TOKEN; mismatch or unset var → 404. Sets noindex. |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| PORT | Server port (default: 3000) |
| DATA_DIR | SQLite DB directory (default: ./data) |
| ADMIN_USER | Admin basic auth username |
| ADMIN_PASS | Admin basic auth password |
| SMTP_USER | Gmail sender address |
| SMTP_PASS | Gmail app password |
| ALERT_EMAIL | Recipient for contact form + error alerts |
| TEST_REMINDER | Set to "1" to send test reminder 60s after startup |
| ORGANIZER_TOKEN | 32-char secret (openssl rand -hex 16) for the /organizers/:token view; unset = feature off |

## Email Reminders

- **Scheduled via node-cron** (Europe/Athens timezone):
  - June 24, 2026 10:00 AM — "in one month" reminder
  - July 17, 2026 10:00 AM — "in one week" reminder
- Sends styled HTML email to all attendees (yes + maybe)
- Manual trigger: `POST /admin/reminder` with basic auth

## Database

SQLite at `$DATA_DIR/rsvp.db` (WAL mode). Single table:

```sql
rsvps (id, created_at, name, email, attending, notes)
```

- `plus_one` column exists in schema but is unused (legacy)
- `attending` values: 'yes', 'maybe', 'no'

## Deployment

Built from GitHub URL in is-infra docker-compose:
```yaml
build:
  context: https://github.com/iasonS/reunion-site.git
```

Deploy flow: push to GitHub → SSH to server → `docker compose up -d --build reunion-site`

## Easter Egg

Type "owls" anywhere on the main page → 60 owl emojis rain from the top.
