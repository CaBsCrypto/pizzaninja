# SpicyCrust Game Ecosystem REST API Specification

## 1. Overview & Architecture

The SpicyCrust Game Ecosystem API is a lightweight, secure, modular REST API built with PHP and MySQL. It manages player identities, score submissions, game leaderboards (per-game and global), and competitive seasons across all SpicyCrust web games.

### Core Principles & Architecture
- **Base URL Prefix**: `/api/v1`
- **Database Access**: Exclusively PDO prepared statements (`PDO::PREPARE` with bound parameters) to prevent SQL injection.
- **Authentication Scheme**: Game API Key Bearer authentication via `Authorization: Bearer <game_api_key>`. Keys are stored in the database hashed (`api_key_hash`).
- **Response Format**: All API endpoints return JSON formatted responses wrapped in a standard JSON response envelope.
- **Rate Limiting**: IP-based and/or Token-based rate limiting (filesystem/MySQL storage) returning HTTP `429 Too Many Requests` when exceeded.
- **CORS Control**: Access-Control-Allow-Origin headers configured for valid SpicyCrust web origins.

---

## 2. Standard Response Envelopes & Status Codes

### Success Response Envelope Structure
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```
*Note: `meta` is included for paginated endpoints or metadata summary.*

### Error Response Envelope Structure
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description of error"
  }
}
```

### Standard HTTP Status Codes

| HTTP Status Code | Name | Scenario / Cause | Standard Error Code |
|---|---|---|---|
| `200` | OK | Successful GET or payload processing. | N/A |
| `201` | Created | Resource successfully created (e.g. score submission). | N/A |
| `400` | Bad Request | Malformed JSON, syntax error, missing mandatory payload fields. | `BAD_REQUEST`, `INVALID_JSON` |
| `401` | Unauthorized | Missing or invalid `Authorization: Bearer <token>` header. | `UNAUTHORIZED`, `INVALID_API_KEY` |
| `403` | Forbidden | Game inactive/revoked or CORS origin header rejected. | `FORBIDDEN`, `CORS_ORIGIN_DENIED` |
| `404` | Not Found | Route, game slug, player, or season not found. | `NOT_FOUND`, `GAME_NOT_FOUND`, `SEASON_NOT_FOUND` |
| `422` | Unprocessable Entity | Payload semantic validation failure (negative/non-numeric score, bad metadata JSON, invalid email). | `VALIDATION_ERROR`, `INVALID_SCORE`, `INVALID_METADATA` |
| `429` | Too Many Requests | Rate limit exceeded for client IP or API key. | `RATE_LIMIT_EXCEEDED` |

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Health Check | System Health Verification | Returns API status and system connectivity | None | `{"success": true, "data": {"status": "ok"}}` | `429 Too Many Requests` on abuse | `ORIGINAL_REQUEST.md` R3 / Acceptance Criteria |
| 2 | Score Management | Authenticated Score Submission | Submits numeric score and JSON metadata for a player in a game | `Authorization: Bearer <token>`, JSON body (`player_id`, `score`, `metadata`, `nickname`) | `201 Created` with score record | `400` bad syntax, `401` missing/invalid key, `403` forbidden, `422` invalid score/metadata, `429` rate limit | `ORIGINAL_REQUEST.md` R1, R2, Acceptance Criteria |
| 3 | Leaderboard | Per-Game Leaderboard | Returns ranked player list filtered by game and optional season | Query params (`game`, `season_id`, `limit`, `page`) | `200 OK` with per-game ranks and player nicknames | `400` bad query params, `404` game/season not found, `429` rate limit | `ORIGINAL_REQUEST.md` R1, Acceptance Criteria |
| 4 | Leaderboard | Global Ecosystem Leaderboard | Aggregates player performance across all SpicyCrust games | Query params (`limit`, `page`, `metric`) | `200 OK` with cross-game global rankings | `400` bad query params, `429` rate limit | `ORIGINAL_REQUEST.md` R1, Acceptance Criteria |
| 5 | Seasons | Season Listing | Returns active, past, and upcoming competitive season details | Query params (`status`, `limit`, `page`) | `200 OK` with season list | `400` bad query params, `429` rate limit | `ORIGINAL_REQUEST.md` R1, Acceptance Criteria |
| 6 | Seasons | Current Active Season | Returns the current active season details | None | `200 OK` with current season object (or null) | `404` if no season active (or null data), `429` rate limit | `ORIGINAL_REQUEST.md` R1, Acceptance Criteria |
| 7 | Player Identity | Cross-Game Player Profile | Manages and fetches cross-game player identity and statistics | Query/Path (`external_id`), Body (`nickname`, `email`) | `200 OK` player profile & score statistics | `404` player not found, `422` validation failure | `ORIGINAL_REQUEST.md` R1 (implied) |
| 8 | Games Management | Game Ecosystem Registry | Fetches active registered games in SpicyCrust ecosystem | None | `200 OK` with list of registered game slugs & names | `429` rate limit | `ORIGINAL_REQUEST.md` R1 (implied) |

---

## 4. Detailed Endpoint Specifications

### 4.1 GET `/api/v1/health`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/health`
- **Authentication**: None (Public)
- **Request Headers**:
  - `Accept: application/json`
- **Query Parameters**: None
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```
- **Possible Error Status Codes**:
  - `429 Too Many Requests` (`{"success": false, "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please try again later."}}`)

---

### 4.2 POST `/api/v1/scores`
- **HTTP Verb**: `POST`
- **URL Pattern**: `/api/v1/scores`
- **Authentication**: Required (`Authorization: Bearer <game_api_key>`)
- **Request Headers**:
  - `Authorization: Bearer <game_api_key>` (Required)
  - `Content-Type: application/json` (Required)
- **Request JSON Schema**:
```json
{
  "type": "object",
  "required": ["player_id", "score"],
  "properties": {
    "player_id": { "type": "string", "minLength": 1, "description": "Cross-game external player ID" },
    "nickname": { "type": "string", "maxLength": 50, "description": "Optional player display nickname" },
    "score": { "type": "number", "minimum": 0, "description": "Numeric score achieved" },
    "game_slug": { "type": "string", "description": "Optional game slug override (if key is multi-game)" },
    "metadata": { "type": "object", "description": "Optional JSON object containing gameplay telemetry" }
  }
}
```
- **Example Request Body**:
```json
{
  "player_id": "usr_99812",
  "nickname": "PepperoniNinja",
  "score": 12500,
  "metadata": {
    "level_reached": 15,
    "combos": 34,
    "play_time_sec": 210
  }
}
```
- **Success Response Code**: `201 Created`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "score_id": 1084,
    "game_slug": "pizza-ninja",
    "player_id": "usr_99812",
    "nickname": "PepperoniNinja",
    "score": 12500,
    "metadata": {
      "level_reached": 15,
      "combos": 34,
      "play_time_sec": 210
    },
    "season_id": 1,
    "created_at": "2026-08-11T04:55:46Z"
  }
}
```
- **Possible Error Status Codes & Envelopes**:
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "error": {
        "code": "INVALID_JSON",
        "message": "Malformed JSON body in request."
      }
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "success": false,
      "error": {
        "code": "UNAUTHORIZED",
        "message": "Missing or invalid Bearer API key token."
      }
    }
    ```
  - `403 Forbidden`:
    ```json
    {
      "success": false,
      "error": {
        "code": "FORBIDDEN",
        "message": "Game API key is deactivated or origin is restricted."
      }
    }
    ```
  - `422 Unprocessable Entity`:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Score must be a non-negative numeric value."
      }
    }
    ```
  - `429 Too Many Requests`:
    ```json
    {
      "success": false,
      "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Rate limit exceeded. Try again in 60 seconds."
      }
    }
    ```

---

### 4.3 GET `/api/v1/leaderboard`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/leaderboard`
- **Authentication**: None (Public)
- **Request Headers**: `Accept: application/json`
- **Query Parameters**:
  - `game` (string, required): Slug of the game (e.g. `pizza-ninja`).
  - `season_id` (integer/string, optional): Season ID or slug filter.
  - `limit` (integer, optional, default `50`, min `1`, max `100`): Results per page.
  - `page` (integer, optional, default `1`, min `1`): Page number.
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "game": "pizza-ninja",
    "season": "season-1",
    "rankings": [
      {
        "rank": 1,
        "player_id": "usr_99812",
        "nickname": "PepperoniNinja",
        "score": 12500,
        "submitted_at": "2026-08-11T04:55:46Z"
      },
      {
        "rank": 2,
        "player_id": "usr_44120",
        "nickname": "MozzarellaPro",
        "score": 11200,
        "submitted_at": "2026-08-10T18:22:10Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "total_records": 150,
    "total_pages": 3
  }
}
```
- **Possible Error Status Codes & Envelopes**:
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "error": {
        "code": "INVALID_QUERY_PARAM",
        "message": "Parameter 'limit' must be an integer between 1 and 100."
      }
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "success": false,
      "error": {
        "code": "GAME_NOT_FOUND",
        "message": "Game with slug 'unknown-game' does not exist."
      }
    }
    ```
  - `429 Too Many Requests`

---

### 4.4 GET `/api/v1/leaderboard/global`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/leaderboard/global`
- **Authentication**: None (Public)
- **Request Headers**: `Accept: application/json`
- **Query Parameters**:
  - `limit` (integer, optional, default `50`, min `1`, max `100`)
  - `page` (integer, optional, default `1`, min `1`)
  - `metric` (string, optional, default `total_score`, options: `total_score`, `highest_score`, `games_played`)
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "metric": "total_score",
    "rankings": [
      {
        "rank": 1,
        "player_id": "usr_99812",
        "nickname": "PepperoniNinja",
        "total_score": 48900,
        "highest_score": 12500,
        "games_played": 6
      },
      {
        "rank": 2,
        "player_id": "usr_10022",
        "nickname": "CalzoneMaster",
        "total_score": 42100,
        "highest_score": 11000,
        "games_played": 5
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "total_records": 80,
    "total_pages": 2
  }
}
```
- **Possible Error Status Codes**:
  - `400 Bad Request`: Invalid metric or pagination params.
  - `429 Too Many Requests`

---

### 4.5 GET `/api/v1/seasons`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/seasons`
- **Authentication**: None (Public)
- **Request Headers**: `Accept: application/json`
- **Query Parameters**:
  - `status` (string, optional, default `all`, options: `all`, `active`, `past`, `upcoming`)
  - `limit` (integer, optional, default `20`)
  - `page` (integer, optional, default `1`)
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "season-1",
      "name": "Summer Crust Showdown 2026",
      "start_date": "2026-06-01T00:00:00Z",
      "end_date": "2026-08-31T23:59:59Z",
      "is_active": true
    },
    {
      "id": 0,
      "slug": "season-0",
      "name": "Beta Founder Season",
      "start_date": "2026-01-01T00:00:00Z",
      "end_date": "2026-05-31T23:59:59Z",
      "is_active": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_records": 2,
    "total_pages": 1
  }
}
```
- **Possible Error Status Codes**:
  - `400 Bad Request`
  - `429 Too Many Requests`

---

### 4.6 GET `/api/v1/seasons/current`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/seasons/current`
- **Authentication**: None (Public)
- **Request Headers**: `Accept: application/json`
- **Query Parameters**: None
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "season-1",
    "name": "Summer Crust Showdown 2026",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    "is_active": true
  }
}
```
*Note: If no season is currently active, returns `200 OK` with `"data": null` or `404 Not Found` with `SEASON_NOT_FOUND`.*

---

### 4.7 Implied Endpoint: GET `/api/v1/players/{external_id}`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/players/{external_id}`
- **Authentication**: None (Public)
- **Request Headers**: `Accept: application/json`
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": {
    "player_id": "usr_99812",
    "nickname": "PepperoniNinja",
    "total_scores_submitted": 14,
    "highest_score_overall": 12500,
    "created_at": "2026-02-01T10:00:00Z"
  }
}
```
- **Possible Error Status Codes**:
  - `404 Not Found` (`{"success": false, "error": {"code": "PLAYER_NOT_FOUND", "message": "Player ID not found."}}`)

---

### 4.8 Implied Endpoint: GET `/api/v1/games`
- **HTTP Verb**: `GET`
- **URL Pattern**: `/api/v1/games`
- **Authentication**: None (Public)
- **Success Response Code**: `200 OK`
- **Success JSON Schema**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "pizza-ninja",
      "name": "Pizza Ninja"
    },
    {
      "id": 2,
      "slug": "crust-runner",
      "name": "Crust Runner"
    }
  ]
}
```

---

## 5. Edge Cases & Validation Matrix

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | POST /api/v1/scores | Missing `Authorization` header | Returns `401 Unauthorized` (`{"success": false, "error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header"}}`) |
| 2 | POST /api/v1/scores | Invalid or expired API Key (`Bearer invalid_key_hash`) | Returns `401 Unauthorized` (`{"success": false, "error": {"code": "INVALID_API_KEY", "message": "Invalid game API key token"}}`) |
| 3 | POST /api/v1/scores | Score is negative (`"score": -100`) or non-numeric (`"score": "one hundred"`) | Returns `422 Unprocessable Entity` (`{"success": false, "error": {"code": "INVALID_SCORE", "message": "Score must be a positive numeric value"}}`) |
| 4 | POST /api/v1/scores | `metadata` field contains invalid JSON or non-object primitive | Returns `422 Unprocessable Entity` (`{"success": false, "error": {"code": "INVALID_METADATA", "message": "Metadata must be a valid JSON object"}}`) |
| 5 | POST /api/v1/scores | Extremely large score payload exceeding `INT_MAX` or double limits | Returns `422 Unprocessable Entity` with range bounds error |
| 6 | GET /api/v1/leaderboard | Missing `game` slug parameter | Returns `400 Bad Request` (`{"success": false, "error": {"code": "MISSING_PARAM", "message": "Query parameter 'game' is required"}}`) |
| 7 | GET /api/v1/leaderboard | Non-existent `game` slug (`?game=nonexistent_game`) | Returns `404 Not Found` (`{"success": false, "error": {"code": "GAME_NOT_FOUND", "message": "Game 'nonexistent_game' not found"}}`) |
| 8 | GET /api/v1/leaderboard | Invalid pagination (`?limit=-10` or `?page=abc`) | Returns `400 Bad Request` with pagination error message |
| 9 | Rate Limiter | High-frequency burst requests exceeding limit (e.g. >60 req/min) | Returns `429 Too Many Requests` (`{"success": false, "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Rate limit exceeded"}}`) |
| 10 | Security / SQLi | Injected SQL payload in player `external_id` or `nickname` | Handled safely by PDO prepared statements; sanitized input |
| 11 | CORS Control | Request origin not in allowed domain whitelist | Returns `403 Forbidden` (`{"success": false, "error": {"code": "CORS_ORIGIN_DENIED", "message": "Origin not allowed"}}`) |
| 12 | GET /api/v1/seasons/current | No active season currently running in `seasons` table | Returns `200 OK` with `"data": null` or `404 Not Found` (`SEASON_NOT_FOUND`) |

---

## 6. Database & Database Security Requirements

1. **Prepared Statements**: All database operations (`SELECT`, `INSERT`, `UPDATE`) MUST use PDO bound parameters (`$stmt->bindValue()` or `$stmt->execute([':param' => $val])`). Direct SQL string concatenation is strictly forbidden.
2. **Game Secrets Hashing**: Game API keys are stored in `games.api_key_hash` using password hashing (e.g. `password_hash($key, PASSWORD_BCRYPT)` or `hash('sha256', $key)`).
3. **Player Identity**: Cross-game identity stored in `players.external_id` (indexed unique string).
4. **Metadata Storage**: `scores.metadata` column typed as `JSON` (or `TEXT` with JSON validation in PHP).
