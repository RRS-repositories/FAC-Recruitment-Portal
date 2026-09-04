# fac-recruitment-server

API for the FAC recruitment portal. Express + PostgreSQL, no CRM connection.

```bash
cp .env.example .env    # then fill it in
npm install
npm run dev             # http://127.0.0.1:5020
npm test
```

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Process is up |
| `GET /api/health/db` | Database is reachable — this is the one worth alerting on |

## Scheduling is anchored to UK time

Availability rules live in `Europe/London` and are converted outward per
candidate. The UK is the only one of the three zones that observes daylight
saving (India is UTC+5:30 year-round, South Africa UTC+2), so a fixed 09:00 UK
slot is 13:30 IST in summer and 14:30 IST in winter. That shift is correct
behaviour and is pinned by `lib/timezone.test.js`.

Anchoring instead to the interviewer's own IST day was considered and rejected:
it would have offered South African candidates interview slots at 05:30 their
local time.
