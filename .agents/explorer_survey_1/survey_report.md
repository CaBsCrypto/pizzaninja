# Environment & Codebase Survey Report: SpicyCrust Game Ecosystem API

**Date**: 2026-08-11
**Target Path**: `C:\Users\MGC\Documents\antigravity\blissful-hawking\spicycrust-game-api`
**Metadata Path**: `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_1`
**Integrity Mode**: Development

---

## 1. Executive Summary

This survey evaluates the environment capabilities, security constraints, database options, web server runtimes, testing tools, and architectural requirements for the **SpicyCrust Game Ecosystem API**.

The project is a lightweight, secure, and extensible REST API written in PHP for managing player identities, score submissions, game leaderboards, and competitive seasons across all SpicyCrust web games.

---

## 2. Requirements Analysis (`ORIGINAL_REQUEST.md`)

The specification defines 3 core feature pillars and 5 primary API endpoints:

### Core Requirements
1. **R1: Core Data & API Architecture**
   - Modular PHP HTTP REST API (`/api/v1/...`).
   - Relational schema: `games` (slug, `api_key_hash`), `players` (`external_id`, nickname), `scores` (numeric score, JSON metadata), `seasons` (name, start/end dates, active status).
   - PDO prepared statements exclusively for database operations.

2. **R2: Security, Authentication & Abuse Prevention**
   - Game API key hashing and verification (`Authorization: Bearer <token>`).
   - CORS origin header control (`Access-Control-Allow-Origin`, preflight handling).
   - HTTP payload validation (types, limits, JSON formatting).
   - Rate limiting (filesystem- or MySQL/SQLite-backed).
   - Input sanitization (SQL Injection, XSS, score manipulation prevention).
   - Standard JSON error envelopes with standard status codes (`400`, `401`, `403`, `404`, `422`, `429`).

3. **R3: Documentation, Seeding & Tests**
   - Database schema & seed scripts (`schema.sql`, `seed.sql`).
   - Environment configuration sample (`.env.example`).
   - Comprehensive documentation (`README.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`).
   - Automated test suite verifying all endpoints and error branches.

### Target API Endpoints
- `GET /api/v1/health` -> `{"success": true, "data": {"status": "ok"}}`
- `POST /api/v1/scores` -> Submits score + metadata (requires Bearer game API key)
- `GET /api/v1/leaderboard` -> Per-game rankings (ranks, nicknames, scores)
- `GET /api/v1/leaderboard/global` -> Cross-game global rankings
- `GET /api/v1/seasons` & `GET /api/v1/seasons/current` -> Past/active season details

---

## 3. Environment & Runtime Capabilities Assessment

### A. Environment Execution Constraints
- **Operating System**: Windows (PowerShell shell environment).
- **Workspace Boundary**: Local file operations within `C:\Users\MGC\Documents\antigravity\blissful-hawking\` are fully accessible.
- **Interactive Approval Constraint**: Terminal commands (`run_command`) and filesystem operations outside the workspace trigger interactive user approval prompts, which time out in unattended subagent execution.
- **Development Strategy**: Design all code, test runners, and database setup scripts to be 100% self-contained within the project workspace, operating cleanly under standard PHP CLI and zero-dependency scripts.

### B. PHP CLI Binary & Extensions
- **PHP CLI**: Standard PHP 8.x CLI binary environment on Windows.
- **Core Extensions Required**:
  - `pdo` (Core PDO abstraction interface)
  - `pdo_mysql` (MySQL database driver for production/dev MySQL environments)
  - `pdo_sqlite` (SQLite 3 database driver for zero-config local dev & testing fallback)
  - `json` (JSON request/response encoding/decoding and metadata storage)
  - `mbstring` (Multi-byte string handling for input sanitization and player nickname validation)
  - `openssl` / `hash` (Secure API key hashing using `hash_hmac` / `password_hash` / SHA-256)
  - `curl` (HTTP testing capabilities)

### C. Web Server Options
1. **Primary Option — PHP Built-in CLI Web Server**:
   - Command: `php -S 127.0.0.1:8000 -t public public/index.php` or `public/index.php` front-controller routing script.
   - Advantages: Native to standard PHP CLI, zero external web server configuration (no Apache/Nginx required), supports header parsing (`Authorization`), HTTP verbs (GET, POST, OPTIONS), and query parameters.

### D. Database Capabilities & Dual-Driver Strategy
1. **Primary Database Target: MySQL 8.0+ / MariaDB**:
   - Connector: PDO MySQL (`pdo_mysql`).
   - Host: `127.0.0.1:3306` (configured via `.env`).
2. **Fallback & Local Testing Target: SQLite 3**:
   - Connector: PDO SQLite (`pdo_sqlite`).
   - Storage: File-based `database/spicycrust.sqlite` or in-memory `:memory:`.
   - **Architectural Recommendation**: The PDO database abstraction layer should detect the configured `DB_DRIVER` (`mysql` vs `sqlite`) in `.env` and adjust DSN/SQL syntax where necessary (e.g. `AUTO_INCREMENT` vs `AUTOINCREMENT`). This guarantees that the API and test suite can execute reliably regardless of local MySQL server status.

### E. Automated Testing Capabilities & Strategy
1. **Option A: Custom Zero-Dependency PHP Test Suite (`tests/run_tests.php`)**:
   - Built directly in native PHP.
   - Executes endpoint handler logic directly or fires HTTP requests to `php -S` / in-memory router.
   - Verifies 100% of acceptance criteria: `/health`, `/scores`, `/leaderboard`, `/leaderboard/global`, `/seasons`, rate-limiting (`429`), auth (`401`/`403`), validation (`400`/`422`), and invalid routes (`404`).
   - Provides clear CLI output and exit code `0` on success.
2. **Option B: PHPUnit (if available in environment)**:
   - Configured via `phpunit.xml`.

---

## 4. Recommended Project Structure

```
spicycrust-game-api/
├── ORIGINAL_REQUEST.md
├── .env.example
├── schema.sql
├── seed.sql
├── README.md
├── public/
│   ├── index.php             # Front controller & router
│   └── .htaccess             # Apache fallback rules (optional)
├── config/
│   ├── database.php          # Database PDO connection factory (MySQL/SQLite)
│   └── config.php            # Environment loader & app settings
├── src/
│   ├── Controllers/
│   │   ├── HealthController.php
│   │   ├── ScoreController.php
│   │   ├── LeaderboardController.php
│   │   └── SeasonController.php
│   ├── Middleware/
│   │   ├── AuthMiddleware.php
│   │   ├── RateLimitMiddleware.php
│   │   └── CorsMiddleware.php
│   ├── Models/
│   │   ├── Game.php
│   │   ├── Player.php
│   │   ├── Score.php
│   │   └── Season.php
│   └── Utils/
│       ├── Response.php       # Standardized JSON response envelope generator
│       ├── Validator.php      # Input validation & sanitization
│       └── Security.php       # Hashing, token verification, XSS prevention
├── docs/
│   ├── API.md                # Endpoint specs, requests & response samples
│   ├── SECURITY.md           # Auth, hashing, CORS, rate limiting & threat model
│   └── ARCHITECTURE.md       # Core design, database schema & component diagram
└── tests/
    ├── run_tests.php         # Standalone test runner
    ├── HealthTest.php
    ├── ScoreTest.php
    ├── LeaderboardTest.php
    ├── SeasonTest.php
    └── SecurityTest.php
```

---

## 5. Conclusion & Next Steps

1. The target folder currently contains `ORIGINAL_REQUEST.md`.
2. All requirements for R1, R2, and R3 are clearly mapped and achievable using a modular, lightweight PHP REST architecture.
3. Dual PDO driver support (`pdo_mysql` + `pdo_sqlite`) ensures resilient database operation under any dev/test environment.
4. Custom PHP test runner (`tests/run_tests.php`) ensures automated test validation can run without external tool dependencies.
