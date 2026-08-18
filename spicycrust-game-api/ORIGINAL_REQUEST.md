# Original User Request

## Follow-up — 2026-08-11T04:55:46Z

SpicyCrust Game Ecosystem API: A lightweight, secure, and extensible REST API written in PHP/MySQL for managing player identities, score submissions, game leaderboards, and competitive seasons across all SpicyCrust web games.

Working directory: C:\Users\MGC\Documents\antigravity\blissful-hawking\spicycrust-game-api
Integrity mode: development

## Requirements

### R1. Core Ecosystem Data & API Architecture
Build a modular PHP/MySQL HTTP REST API (/api/v1/...) using PDO prepared statements to handle game registration (games table with slug & api_key_hash), cross-game player identity (players table with external_id & nickname), score submissions (scores table with numeric score and JSON metadata), leaderboards (per-game and global), and competitive seasons (seasons table).

### R2. Security, Authentication & Abuse Prevention
Implement game API key hashing/verification (Authorization: Bearer <token>), CORS origin control, HTTP request payload validation (types, limits, JSON formatting), rate limiting (filesystem/MySQL based), and input sanitization to block SQL injection, XSS, and trivial replay/score manipulation without exposing sensitive secrets in errors or repository code.

### R3. Documentation, Seeding & Tests
Provide database schema scripts (schema.sql, seed.sql), clear environment configuration (.env.example), complete documentation (README.md, docs/API.md, docs/SECURITY.md, docs/ARCHITECTURE.md), and automated test suites verifying all endpoints and error cases.

## Acceptance Criteria

### API Endpoints & Functionality
- [ ] GET /api/v1/health returns {"success": true, "data": {"status": "ok"}}
- [ ] POST /api/v1/scores accepts scores authenticated via game API key and stores numeric score + JSON metadata
- [ ] GET /api/v1/leaderboard returns per-game rankings with player nicknames, ranks, and scores
- [ ] GET /api/v1/leaderboard/global returns global ecosystem rankings
- [ ] GET /api/v1/seasons and /api/v1/seasons/current return active/past season details

### Security & Quality
- [ ] Invalid requests (missing headers, bad JSON, unauthenticated games, invalid emails/scores) return appropriate HTTP status codes (400, 401, 403, 404, 422, 429) and standard JSON error envelopes
- [ ] Database access exclusively uses PDO prepared statements
- [ ] Rate limiting blocks excessive requests with 429 Too Many Requests
- [ ] Test suite runs automatically and passes for all core endpoints
