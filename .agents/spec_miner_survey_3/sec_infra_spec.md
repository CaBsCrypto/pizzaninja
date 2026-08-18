# SpicyCrust Game Ecosystem API — Security & Infrastructure Specification

**Author:** Security & Infra Spec Miner  
**Date:** 2026-08-11  
**Working Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\spec_miner_survey_3`  
**Specification Target:** `spicycrust-game-api`  
**Source Specification:** `ORIGINAL_REQUEST.md`

---

## 1. Overview & System Scope

The **SpicyCrust Game Ecosystem API** is a lightweight, secure, and extensible REST API engineered in PHP/MySQL utilizing PDO prepared statements. It manages cross-game player identities, score submissions, game-specific and global leaderboards, and competitive seasons across all SpicyCrust web games.

This document serves as the authoritative Security, Database Schema, and Infrastructure specification mined from `ORIGINAL_REQUEST.md`.

---

## 2. Security Architecture & Abuse Prevention Specification

### 2.1 API Key Authentication & Hashing Protocol
* **Header Format**: `Authorization: Bearer <token>`
* **Key Storage**: Raw API keys MUST NEVER be stored in plain text. The `games` database table stores `api_key_hash`.
* **Hashing Mechanism**: Secure password/key hashing (e.g., `password_hash($rawKey, PASSWORD_BCRYPT)` or SHA-256 binary hash `hash('sha256', $rawKey)`).
* **Verification Algorithm**:
  1. Extract Bearer token from HTTP request header `Authorization`.
  2. Locate the game record by slug or iterate active games.
  3. Validate token against stored `api_key_hash` using timing-attack-safe comparison (`password_verify()` or `hash_equals()`).
  4. If invalid or missing header, reject immediately with `HTTP 401 Unauthorized`.

### 2.2 CORS Header Handling
* **Allowed Origins**: Configurable via `.env` (`CORS_ALLOWED_ORIGINS`), defaulting to `*` in development or specific domain list in production.
* **Required Response Headers**:
  * `Access-Control-Allow-Origin: <origin>`
  * `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  * `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
  * `Access-Control-Max-Age: 86400`
* **Preflight Requests**: All HTTP `OPTIONS` requests must be intercepted early, returning `204 No Content` (or `200 OK`) with CORS headers attached, bypassing authentication middleware.

### 2.3 HTTP Payload & Input Validation
* **Content-Type**: Requests with body (e.g., `POST /api/v1/scores`) must specify `Content-Type: application/json`.
* **JSON Syntax**: Malformed JSON triggers `HTTP 400 Bad Request`.
* **Validation Rules**:
  * `game_slug`: String, non-empty, max length 50, alpha-numeric with hyphens.
  * `external_id`: String, non-empty, max length 100.
  * `nickname`: String, non-empty, max length 50.
  * `score`: Numeric (Integer or Float), non-negative (unless specified for negative-score games), finite number.
  * `metadata`: Optional JSON object or array, maximum length 4KB when serialized.
* **Validation Error Response**: `HTTP 422 Unprocessable Entity` or `HTTP 400 Bad Request` with descriptive field-level error messages.

### 2.4 Input Sanitization & Threat Mitigation
* **SQL Injection Defense**: 100% of database queries MUST use PDO prepared statements with explicit parameter binding (`$stmt->prepare()`, `$stmt->execute([':param' => $val])`). Raw SQL query concatenation is strictly prohibited.
* **XSS Prevention**: User-controlled text inputs (such as player `nickname`) must be sanitized using `htmlspecialchars($nickname, ENT_QUOTES, 'UTF-8')` or tag stripping prior to persistence or display.
* **Replay & Score Manipulation Prevention**:
  * Score submissions require valid Game Bearer token authentication.
  * Verification of active competitive season boundaries (`start_at` <= `NOW()` <= `end_at`).
  * Score value bounds validation per game config.

### 2.5 Rate Limiting Mechanism
* **Storage Driver**: Filesystem-based (file-locking JSON/text storage under `storage/ratelimit/`) or MySQL-based (`rate_limits` table with cleanup window).
* **Identity Identifier**: Client IP (`$_SERVER['REMOTE_ADDR']`) combined with Game API Key.
* **Limit Rule**: Default 60 requests per minute per IP / Game Key.
* **Exceeded Behavior**: Return `HTTP 429 Too Many Requests` with response envelope:
  ```json
  {
    "success": false,
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests. Please try again later."
    }
  }
  ```
* **Headers**: `Retry-After: 60`, `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining: 0`.

### 2.6 Error Hiding & Standard Envelope Format
* **Information Leak Prevention**: In non-development environments, internal database error messages, SQL strings, stack traces, and environment paths MUST be masked.
* **Standard Success Envelope**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
* **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human readable summary error message."
    }
  }
  ```
* **HTTP Status Code Mapping**:
  * `200 OK`: Successful retrieval or action
  * `201 Created`: Successful creation (e.g. score created)
  * `400 Bad Request`: Malformed JSON or invalid parameter syntax
  * `401 Unauthorized`: Missing or invalid Bearer token
  * `403 Forbidden`: Authenticated caller lacks permissions
  * `404 Not Found`: Entity (game, player, endpoint) not found
  * `422 Unprocessable Entity`: Field validation failure
  * `429 Too Many Requests`: Rate limit threshold exceeded
  * `500 Internal Server Error`: Generic unhandled server error (details logged to error log only)

---

## 3. Database Schema Entity Specifications

### 3.1 Entity Architecture (`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

```sql
-- 1. Games Table
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Seasons Table
CREATE TABLE IF NOT EXISTS seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Scores Table
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    season_id INT NULL,
    score BIGINT NOT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scores_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT fk_scores_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_scores_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL,
    INDEX idx_game_score (game_id, score DESC),
    INDEX idx_player_score (player_id, score DESC),
    INDEX idx_season_score (season_id, score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Documentation, Seeding & Testing Artifact Specifications

### 4.1 Required Artifacts List
1. `schema.sql`: Complete DDL script creating `games`, `players`, `seasons`, `scores` tables, indexes, and constraints.
2. `seed.sql`: Data seeding script populating initial sample games (`crust-runner`, `pizza-ninja`), sample active/past seasons, sample players, and sample leaderboard scores with JSON metadata.
3. `.env.example`: Configuration template declaring `APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `CORS_ALLOWED_ORIGINS`, and `RATE_LIMIT_REQUESTS_PER_MINUTE`.
4. `README.md`: Ecosystem setup instructions, environment installation guide, database initialization steps, development server execution, and test execution commands.
5. `docs/API.md`: Full API endpoint documentation for `/health`, `/scores`, `/leaderboard`, `/leaderboard/global`, `/seasons`, `/seasons/current`.
6. `docs/SECURITY.md`: Detailed security architecture specification covering authentication, hashing, CORS, rate limiting, and SQLi/XSS mitigation.
7. `docs/ARCHITECTURE.md`: High-level system design document covering PHP/MySQL PDO stack architecture, directory layout, routing, middleware execution order, and error handling.
8. Automated Test Suite (`tests/` directory): Complete test suite covering health check, score submission, authorization failures, payload validation failures, rate limiting, and leaderboard sorting.

---

## 5. Features Discovered

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Ecosystem API | Health Check Endpoint | Returns system operational status | None (`GET /api/v1/health`) | `{"success": true, "data": {"status": "ok"}}` | `500 Internal Server Error` if server unhealthy | `ORIGINAL_REQUEST.md` R1 & AC |
| 2 | Ecosystem API | Score Submission | Authenticates game and persists player score + JSON metadata | `POST /api/v1/scores` with JSON body (`game_slug`, `external_id`, `nickname`, `score`, `metadata`) + `Authorization: Bearer <token>` | `{"success": true, "data": {"id": 1, "score": 100, ...}}` | `401 Unauthorized` (bad token), `400/422` (bad body) | `ORIGINAL_REQUEST.md` R1, R2, AC |
| 3 | Ecosystem API | Per-Game Leaderboard | Returns ranked player list for a specific game | `GET /api/v1/leaderboard?game=crust-runner&limit=10&page=1` | `{"success": true, "data": {"game": "crust-runner", "rankings": [...]}}` | `404 Not Found` (invalid game), `400 Bad Request` | `ORIGINAL_REQUEST.md` R1 & AC |
| 4 | Ecosystem API | Global Leaderboard | Returns ecosystem-wide top players across games | `GET /api/v1/leaderboard/global?limit=10` | `{"success": true, "data": {"rankings": [...]}}` | `400 Bad Request` (invalid params) | `ORIGINAL_REQUEST.md` R1 & AC |
| 5 | Ecosystem API | Seasons List | Retrieves past and present competitive seasons | `GET /api/v1/seasons` | `{"success": true, "data": [{"id": 1, "slug": "season-1", ...}]}` | `500 Internal Server Error` | `ORIGINAL_REQUEST.md` R1 & AC |
| 6 | Ecosystem API | Current Active Season | Retrieves current active season details | `GET /api/v1/seasons/current` | `{"success": true, "data": {"id": 1, "name": "Fall 2026", "is_active": 1}}` | `404 Not Found` if no active season | `ORIGINAL_REQUEST.md` R1 & AC |
| 7 | Security | API Key Hashing & Authentication | Verifies game identity via Bearer token against stored `api_key_hash` | `Authorization: Bearer <token>` | Verified game identity context | `401 Unauthorized` on missing/invalid token | `ORIGINAL_REQUEST.md` R2 |
| 8 | Security | CORS Header Management | Enables cross-origin requests from game web clients | Request headers (`Origin`, `Access-Control-Request-Method`) | CORS headers (`Access-Control-Allow-Origin`, etc.) | `204 No Content` for `OPTIONS` preflight | `ORIGINAL_REQUEST.md` R2 |
| 9 | Security | HTTP Payload Validation | Validates request payload types, sizes, and JSON format | Raw HTTP POST body | Sanitized and parsed data object | `400 Bad Request` or `422 Unprocessable Entity` | `ORIGINAL_REQUEST.md` R2 |
| 10 | Security | Input Sanitization & Threat Defense | Strips/escapes HTML to block XSS and prevents SQL injection via PDO | String inputs (nickname, external_id) | Safe sanitized strings | Stripped/escaped input or validation rejection | `ORIGINAL_REQUEST.md` R2 |
| 11 | Security | Rate Limiting Mechanism | Enforces filesystem/MySQL request quotas to prevent abuse | Client IP and API Key | Request allowed or rate limit metadata | `429 Too Many Requests` on quota exceed | `ORIGINAL_REQUEST.md` R2 & AC |
| 12 | Security | Error Masking & Response Envelope | Standardizes JSON envelopes and hides sensitive stack traces | API processing errors / exceptions | Clean JSON error envelope | Hides raw database exception messages | `ORIGINAL_REQUEST.md` R2 & AC |
| 13 | Database Schema | Game Entity Management | Stores registered games with slug and API key hash | `games` table schema | Persistent game record | Duplicate `slug` constraint error | `ORIGINAL_REQUEST.md` R1 |
| 14 | Database Schema | Player Identity Management | Manages cross-game player identities | `players` table schema | Persistent player record | Duplicate `external_id` constraint handling | `ORIGINAL_REQUEST.md` R1 |
| 15 | Database Schema | Scores & Metadata Persistence | Records numerical score with custom JSON metadata | `scores` table schema | Persistent score record | FK constraint error if invalid game/player | `ORIGINAL_REQUEST.md` R1 |
| 16 | Database Schema | Seasons Management | Defines competitive season timeframes and active status | `seasons` table schema | Persistent season record | Time overlap or inactive season error | `ORIGINAL_REQUEST.md` R1 |
| 17 | Infrastructure | Database Schema DDL Script | `schema.sql` creating tables, indexes, constraints | SQL script execution | Prepared database schema | Table creation execution error | `ORIGINAL_REQUEST.md` R3 |
| 18 | Infrastructure | Database Seed Script | `seed.sql` initializing games, players, seasons, scores | SQL script execution | Populated seed data | Foreign key order dependency | `ORIGINAL_REQUEST.md` R3 |
| 19 | Infrastructure | Environment Configuration | `.env.example` defining database credentials and app settings | Environment variables | Configured API runtime environment | `500 Internal Server Error` if missing credentials | `ORIGINAL_REQUEST.md` R3 |
| 20 | Documentation | System Documentation Suite | Complete project README, API spec, Security, and Architecture docs | `README.md`, `docs/*.md` | Human-readable documentation | N/A | `ORIGINAL_REQUEST.md` R3 |
| 21 | Testing | Automated Test Suite | Automated test suite verifying all endpoints, auth, and security | Test runner execution (`php vendor/bin/phpunit` or custom runner) | Test execution pass/fail summary | Returns non-zero exit code on failed tests | `ORIGINAL_REQUEST.md` R3 & AC |

---

## 6. Edge Cases

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | API Key Authentication | `POST /api/v1/scores` without `Authorization` header | API returns `HTTP 401 Unauthorized` with `{"success": false, "error": {"code": "UNAUTHORIZED", "message": "Missing authorization token."}}` |
| 2 | API Key Authentication | `POST /api/v1/scores` with invalid Bearer token `Bearer bad_token_123` | Token verification fails against `api_key_hash` in DB; API returns `HTTP 401 Unauthorized`. |
| 3 | Payload Validation | `POST /api/v1/scores` with malformed JSON body `{"score": 100,` | JSON parsing fails; API returns `HTTP 400 Bad Request` with `{"success": false, "error": {"code": "INVALID_JSON", "message": "Malformed JSON payload."}}` |
| 4 | Score Submission | `POST /api/v1/scores` with missing required field `nickname` | Validation fails; API returns `HTTP 422 Unprocessable Entity` listing missing mandatory fields. |
| 5 | Score Submission | `POST /api/v1/scores` with non-numeric score `"score": "one_million"` | Validation fails; API returns `HTTP 422 Unprocessable Entity` indicating score must be numeric. |
| 6 | Input Sanitization | Player nickname containing XSS payload `<script>alert('pwned')</script>` | Sanitization strips tags or escapes characters to `&lt;script&gt;...&lt;/script&gt;`, persisting safe string to DB. |
| 7 | Rate Limiting | Executing 61 requests in 30 seconds from same IP | 61st request is blocked by rate limiter middleware, returning `HTTP 429 Too Many Requests` with `Retry-After: 60`. |
| 8 | Leaderboard Query | `GET /api/v1/leaderboard?game=non-existent-game` | Query returns `HTTP 404 Not Found` with `{"success": false, "error": {"code": "GAME_NOT_FOUND", "message": "Specified game does not exist."}}` |
| 9 | Current Season | `GET /api/v1/seasons/current` when no season is currently active (`is_active = 0` for all) | API returns `HTTP 404 Not Found` or `{"success": true, "data": null}` safely without database error. |
| 10 | CORS Preflight | `OPTIONS /api/v1/scores` with header `Origin: https://spicycrust.com` | API immediately returns `HTTP 204 No Content` with CORS headers attached, skipping token auth. |
| 11 | Database Error Hiding | Database server connection down during `GET /api/v1/health` | Exception caught silently; API returns `HTTP 500 Internal Server Error` with generic message, concealing host/port/credentials. |
| 12 | Player Identity Upsert | `POST /api/v1/scores` with existing `external_id` but new `nickname` | Player identity retrieved by `external_id` and `nickname` updated safely without unique constraint duplicate key violation. |
