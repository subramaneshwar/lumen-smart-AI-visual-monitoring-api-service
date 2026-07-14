# lumen-api

NestJS backend for the AI Visual Monitoring Platform. Phase 1 (MVP) is in progress: ingestion, detection events, rules, notifications, retention, and person-matching are implemented; `GET /events` lists/filters stored events for the dashboard. Some routes (`/persons`, `/rules`, `/summaries`, `/chat`) still return `501 Not Implemented`.

## Prerequisites
- Node.js 22+, npm
- Docker Desktop (for Postgres + Redis)

## Setup
```bash
cp .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

## Verify
- `GET http://localhost:3001/health` should return `{"status":"ok",...}` with database and redis both `up`.

## Scripts
- `npm run start:dev` — run in watch mode
- `npm test` — unit tests
- `npm run test:e2e` — e2e tests (requires Docker infra running)
- `npm run lint` — ESLint
- `npm run migration:run` / `npm run migration:revert` — TypeORM migrations

## Status
Scaffold only — see `../Lumen/docs/superpowers/specs/2026-07-08-project-scaffold-design.md` for scope. No detection, rules, notifications, summary, chat, or auth logic yet.
