# Organizers Page — Design

**Date:** 2026-07-10
**Status:** Approved (approach A — secret link)

## Context

Co-organizers keep asking the site owner for RSVP counts and names. They need a
zero-friction, always-current, read-only view. The existing `/admin` page is
too powerful to share: it exposes emails, CSV export, and the manual reminder
trigger. The event is 2026-07-24, so the solution must be simple and shippable
immediately.

## Decision

Add a read-only organizer view behind a secret capability URL:

```
GET /organizers/:token
```

- `:token` is compared (timing-safe) against the `ORGANIZER_TOKEN` env var.
- Mismatch, missing param, or unset env var → **404** (not 401), so the route
  is indistinguishable from a nonexistent page to scanners.
- Match → HTML page with:
  - Stat cards: total / yes / maybe / no (same `db.counts()` as admin)
  - Table columns: **Date, Name, Attending, Notes**
  - **No email column. No CSV export. No reminder trigger. No links to admin.**
- Page includes `<meta name="robots" content="noindex">` and sets
  `X-Robots-Tag: noindex` for good measure.

## Token

- Operator-generated random string (e.g. `openssl rand -hex 8`), set as
  `ORGANIZER_TOKEN` in is-infra `.env`.
- If the link leaks, rotate the env var and redeploy; old links die instantly.
- If `ORGANIZER_TOKEN` is unset, the feature is off (all requests 404).

## Non-goals

- No per-organizer identity, no audit log, no rate limiting (Cloudflare fronts
  the site already).
- No CSV/download for organizers — view only.
- No changes to `/admin`, RSVP flow, or reminders.

## Risk classification

Level 2 (security-adjacent: exposes attendee names/notes behind a capability
URL). Approved by owner 2026-07-10. Rollback: unset `ORGANIZER_TOKEN` or
revert the commit.

## Testing (server.test.js)

1. `GET /organizers/<valid>` → 200, body contains a known RSVP name.
2. `GET /organizers/<wrong>` → 404.
3. `GET /organizers` and `GET /organizers/` → 404.
4. Valid response body contains **no email address** from the DB (regex for
   `@` against seeded email, plus explicit check the seeded email string is
   absent).
5. With `ORGANIZER_TOKEN` unset → 404 even for any token.

## Delivery

Feature branch `feature/organizers-page` → PR → merge → set env var in
is-infra → `docker compose up -d --build reunion-site` → send link to
organizers.
