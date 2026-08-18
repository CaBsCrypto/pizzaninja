# Project: SpicyCrust Game Ecosystem API

## Architecture
- **Language/Runtime**: PHP 8.x (using standard PHP CLI built-in web server `php -S 127.0.0.1:8000 -t public public/index.php`)
- **Database**: MySQL / SQLite via PDO prepared statements (`pdo_mysql` / `pdo_sqlite` abstraction based on `.env`)
- **Pattern**: Modular HTTP REST API Router with Middleware Pipeline (Auth, CORS, Rate Limit, Error Handling)
- **Data Flow**: HTTP Request -> `public/index.php` -> Router -> Middleware Chain -> Controller Handler -> Service/Repository (PDO) -> Standard JSON Response

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Health Check API | `GET /api/v1/health` returning `{"success": true, "data": {"status": "ok"}}` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | DB Schema DDL | `schema.sql` defining `games`, `players`, `seasons`, `scores` tables with FKs and indexes | M1 | ORIGINAL_REQUEST §R1, R3 |
| 3 | DB Seeding | `seed.sql` providing initial test games, players, seasons, and scores | M1 | ORIGINAL_REQUEST §R3 |
| 4 | PDO DB Connection | PDO abstraction supporting prepared statements & `.env` database driver config | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Environment Config | `.env.example` defining DB credentials, app secret, rate limits, CORS settings | M1 | ORIGINAL_REQUEST §R3 |
| 6 | Router & Base Pipeline | Front controller `public/index.php` and HTTP router matching method/path | M1 | ORIGINAL_REQUEST §R1 |
| 7 | Standard Error Envelopes | Uniform JSON error responses for 400, 401, 403, 404, 422, 429 status codes | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Bearer Token Auth | `Authorization: Bearer <key>` auth middleware checking `sha256(key)` vs `games.api_key_hash` | M2 | ORIGINAL_REQUEST §R2 |
| 9 | CORS Origin Control | CORS middleware setting headers & handling `OPTIONS` preflight (`204 No Content`) | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Rate Limiting Middleware | Request rate limiter (file/sqlite/mysql backed) returning `429` with `Retry-After: 60` | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Payload Validation & Sanitization | JSON type checking, field validation, XSS HTML escaping, SQLi protection via PDO | M2 | ORIGINAL_REQUEST §R2 |
| 12 | Score Submission API | `POST /api/v1/scores` validating Bearer token, score, metadata JSON, inserting score record | M3 | ORIGINAL_REQUEST §R1 |
| 13 | Per-Game Leaderboard API | `GET /api/v1/leaderboard?game_slug=...&season_slug=...&limit=...` returning ranked players | M3 | ORIGINAL_REQUEST §R1 |
| 14 | Global Leaderboard API | `GET /api/v1/leaderboard/global` returning cross-game aggregated rankings | M3 | ORIGINAL_REQUEST §R1 |
| 15 | Seasons API | `GET /api/v1/seasons` (all seasons) and `GET /api/v1/seasons/current` (active season) | M3 | ORIGINAL_REQUEST §R1 |
| 16 | System Documentation | Complete `README.md` with setup instructions, local server start, test runner | M4 | ORIGINAL_REQUEST §R3 |
| 17 | API Documentation | `docs/API.md` documenting all endpoints, request/response formats, status codes | M4 | ORIGINAL_REQUEST §R3 |
| 18 | Security Documentation | `docs/SECURITY.md` detailing token hashing, CORS, rate limits, input sanitization | M4 | ORIGINAL_REQUEST §R3 |
| 19 | Architecture Documentation | `docs/ARCHITECTURE.md` detailing technical architecture, ER diagrams, request pipeline | M4 | ORIGINAL_REQUEST §R3 |
| 20 | E2E Test Suite | Comprehensive automated HTTP test suite verifying all endpoints, errors, auth, rate limit | M5 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core DB & API Infrastructure | DDL `schema.sql`, `seed.sql`, PDO connection, `.env.example`, Router, `GET /api/v1/health` | None | PLANNED |
| M2 | Security, Auth & Abuse Prevention | Error Envelopes (400-429), Bearer Auth Middleware, CORS Middleware, Rate Limiter, Payload Validator | M1 | PLANNED |
| M3 | Core Ecosystem REST Endpoints | `POST /api/v1/scores`, `GET /api/v1/leaderboard`, `GET /api/v1/leaderboard/global`, `GET /api/v1/seasons`, `GET /api/v1/seasons/current` | M1, M2 | PLANNED |
| M4 | Complete Project Documentation | `README.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md` | M1, M2, M3 | PLANNED |
| M5 | E2E Test Verification & Hardening | Phase 1: 100% Pass of E2E test suite (Tiers 1-4); Phase 2: Tier 5 Adversarial Coverage Hardening | M1, M2, M3, M4, E2E-Track | PLANNED |

## Interface Contracts
### Middleware Contract
- All middlewares implement `handle(Request $request, Closure $next): Response`
- Standard error envelope: `{"success": false, "error": {"code": "INVALID_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|UNPROCESSABLE_ENTITY|TOO_MANY_REQUESTS", "message": "..."}}`
- Standard success envelope: `{"success": true, "data": ...}`

### Authentication Contract
- Header: `Authorization: Bearer <game_api_key>`
- Hash algorithm: `hash('sha256', $token)` matched against `games.api_key_hash`

## Code Layout
```
spicycrust-game-api/
├── public/
│   ├── .htaccess
│   └── index.php
├── config/
│   └── database.php
├── database/
│   ├── schema.sql
│   └── seed.sql
├── src/
│   ├── Database/
│   │   └── Connection.php
│   ├── Http/
│   │   ├── Request.php
│   │   ├── Response.php
│   │   └── Router.php
│   ├── Middleware/
│   │   ├── AuthMiddleware.php
│   │   ├── CorsMiddleware.php
│   │   └── RateLimitMiddleware.php
│   ├── Controllers/
│   │   ├── HealthController.php
│   │   ├── ScoreController.php
│   │   ├── LeaderboardController.php
│   │   └── SeasonController.php
│   ├── Models/
│   │   ├── Game.php
│   │   ├── Player.php
│   │   ├── Season.php
│   │   └── Score.php
│   └── Validation/
│       └── Validator.php
├── docs/
│   ├── API.md
│   ├── SECURITY.md
│   └── ARCHITECTURE.md
├── tests/
│   ├── run_tests.php
│   └── ...
├── .env.example
├── README.md
└── ORIGINAL_REQUEST.md
```
