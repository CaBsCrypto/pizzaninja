# Detailed Architectural Analysis — Leaderboard & Filtered Redis Schema (Survey Explorer 3)

**Author:** Survey Explorer 3  
**Date:** 2026-08-11  
**Working Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_3`  
**Root Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking`

---

## 1. Executive Summary

This report presents a comprehensive technical investigation of the **Filtered Leaderboard API (`/api/leaderboard` and `/api/leaderboard/rank`)**, Redis key naming schema, multi-period data structures, exact rank & percentile formulas, and the current OpenAPI documentation status in `docs/API_REFERENCE.md`.

### Key Findings
1. **Existing API Codebase (`api/score.ts`)**: Currently uses a legacy Redis key `slashslice:leaderboard_v2` storing JSON strings inside a single Sorted Set. This design suffers from $O(N)$ string scanning during updates and does not support timeframe or mode filtering.
2. **Target Multi-Period Redis Schema**: To support `arcade` | `classic` modes and `alltime` | `weekly` | `daily` timeframes cleanly, leaderboards must be structured as dedicated Redis Sorted Sets (ZSETs) mapping player public keys (`<pubkey>`) to numeric scores (`<score>`), e.g., `slashslice:leaderboard:arcade:alltime`. User metadata will be stored in `slashslice:user:<pubkey>`.
3. **Exact Rank & Percentile Math**: Rank is derived 1-indexed via `ZREVRANK key pubkey + 1`. Percentile score $P = \left(\frac{\text{total} - \text{rank} + 1}{\text{total}}\right) \times 100$, while Top Percentage $T = \left(\frac{\text{rank}}{\text{total}}\right) \times 100$.
4. **OpenAPI Documentation Gap**: `docs/API_REFERENCE.md` currently documents legacy `/api/score`, `/api/mint`, and `/api/mint_nft`, but completely lacks specifications for `POST /api/user`, `GET /api/user`, `GET /api/leaderboard`, and `GET /api/leaderboard/rank`.

---

## 2. Leaderboard Endpoint Requirements

### 2.1 `GET /api/leaderboard`

#### Purpose
Retrieve a paginated list of top players for a specific game mode (`arcade` or `classic`) and timeframe (`alltime`, `weekly`, or `daily`), hydrated with user profile metadata (username, avatar, etc.).

#### Input Query Parameters
| Parameter | Type | Required | Default | Allowed Values / Validation |
| :--- | :--- | :--- | :--- | :--- |
| `mode` | `string` | No | `arcade` | `arcade`, `classic` |
| `timeframe` | `string` | No | `alltime` | `alltime`, `weekly`, `daily` |
| `limit` | `number` | No | `20` | Integer between `1` and `100` |
| `page` | `number` | No | `1` | Integer $\ge 1$ |

#### Key Query Logic
1. Validate `mode` and `timeframe`. If invalid, return HTTP `400 Bad Request`.
2. Construct the target Redis ZSET key:
   - For `alltime`: `slashslice:leaderboard:<mode>:alltime`
   - For `weekly`: `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>` (e.g. `slashslice:leaderboard:arcade:weekly:2026-W32`) or fallback `slashslice:leaderboard:<mode>:weekly`
   - For `daily`: `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>` (e.g. `slashslice:leaderboard:arcade:daily:2026-08-11`) or fallback `slashslice:leaderboard:<mode>:daily`
3. Compute pagination offsets for Redis ZREVRANGE:
   - `start = (page - 1) * limit`
   - `end = start + limit - 1`
4. Query total entries: `total = await client.zcard(key)`
5. Query ranked pubkeys and scores: `rawEntries = await client.zrange(key, start, end, { rev: true, withScores: true })`
6. Hydrate each `pubkey` by batch-fetching user profiles from `slashslice:user:<pubkey>`. If profile does not exist, return fallback profile (`username`: truncated pubkey / `NINJA_ANON`).
7. Calculate `rank = start + index + 1` and `percentile` for each player.

#### Response Schemas
**HTTP 200 OK Response**:
```json
{
  "success": true,
  "mode": "arcade",
  "timeframe": "alltime",
  "page": 1,
  "limit": 20,
  "total": 142,
  "totalPages": 8,
  "rankings": [
    {
      "rank": 1,
      "pubkey": "GAYX4B7K...92L",
      "username": "Ninja_Master",
      "avatar": "https://avatar.url/1.png",
      "score": 4200,
      "percentile": 100.0,
      "topPercentage": 0.7
    },
    {
      "rank": 2,
      "pubkey": "GB3M...V82P",
      "username": "Slice_Chef",
      "avatar": "https://avatar.url/2.png",
      "score": 3800,
      "percentile": 99.3,
      "topPercentage": 1.41
    }
  ]
}
```

**HTTP 400 Bad Request Response**:
```json
{
  "success": false,
  "error": "Invalid timeframe. Allowed values: alltime, weekly, daily"
}
```

---

### 2.2 `GET /api/leaderboard/rank`

#### Purpose
Retrieve a single player's specific rank, total active player count, score, and percentile in a selected mode and timeframe.

#### Input Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `pubkey` | `string` | Conditional* | Stellar public key (`G...`) |
| `username` | `string` | Conditional* | Unique username (resolved to pubkey via `slashslice:username:<username>`) |
| `mode` | `string` | No (default `arcade`) | `arcade` or `classic` |
| `timeframe` | `string` | No (default `alltime`) | `alltime`, `weekly`, `daily` |

*\*At least one of `pubkey` or `username` must be provided.*

#### Processing & Lookup Algorithm
1. If `pubkey` is provided, validate format (Stellar G-address prefix, 56 characters).
2. If `username` is provided and `pubkey` is missing:
   - Perform `GET slashslice:username:<username>`.
   - If key does not exist, return `404 Not Found`.
3. Construct Redis ZSET key for specified `mode` and `timeframe`.
4. Check score: `score = await client.zscore(key, pubkey)`.
   - If `score === null`, return `404 Not Found` (player has no recorded score in this category).
5. Fetch 0-indexed rank: `rank0 = await client.zrevrank(key, pubkey)`.
6. Fetch total players: `totalPlayers = await client.zcard(key)`.
7. Compute 1-indexed rank: `rank = rank0 + 1`.
8. Calculate Percentile Score $P$ and Top Percentage $T$.
9. Hydrate user metadata from `slashslice:user:<pubkey>`.

#### Response Schemas
**HTTP 200 OK Response**:
```json
{
  "success": true,
  "pubkey": "GAYX4B7K...92L",
  "username": "Ninja_Master",
  "avatar": "https://avatar.url/1.png",
  "score": 4200,
  "mode": "arcade",
  "timeframe": "alltime",
  "rank": 1,
  "totalPlayers": 142,
  "percentile": 100.0,
  "topPercentage": 0.7
}
```

**HTTP 404 Not Found Response**:
```json
{
  "success": false,
  "error": "Player not found on specified leaderboard"
}
```

---

## 3. Redis Data Structures & Key Naming Convention

### Proposed Redis Schema Summary

| Entity / Purpose | Key Pattern | Type | Key Member / Field | Value |
| :--- | :--- | :--- | :--- | :--- |
| User Profile | `slashslice:user:<pubkey>` | Hash or JSON | `profile` | JSON string `{ pubkey, username, avatar, privyDid, createdAt, highScores: { arcade, classic } }` |
| Username Index | `slashslice:username:<username>` | String | N/A | `<pubkey>` (used with `SET key pubkey NX` for uniqueness) |
| All-Time Leaderboard | `slashslice:leaderboard:<mode>:alltime` | ZSET | `<pubkey>` | Numeric Score (Float/Integer) |
| Weekly Leaderboard | `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>` | ZSET | `<pubkey>` | Numeric Score |
| Daily Leaderboard | `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>` | ZSET | `<pubkey>` | Numeric Score |

### Advantages of storing `<pubkey>` as ZSET Member
1. **O(1) / O(log N) Lookups**: Direct `ZREVRANK` and `ZSCORE` calls by `pubkey` without iterating or string-parsing.
2. **Atomic Upgrades**: Standard `ZADD key score pubkey` or `ZADD key GT score pubkey` ensures high scores are updated atomically without race conditions.
3. **Clean Decoupling**: Metadata changes (such as updating avatar or username) in `slashslice:user:<pubkey>` automatically reflect in leaderboard queries without rebuilding leaderboard ZSETs.

---

## 4. Exact Rank & Percentile Calculation Formulas

### 4.1 Rank Calculation
- **0-Indexed Rank**: Returned directly by Redis `ZREVRANK(key, pubkey)`. (Rank 0 = highest score).
- **1-Indexed Rank**:
  $$\text{Rank} = \text{ZREVRANK}(\text{key}, \text{pubkey}) + 1$$

### 4.2 Percentile Calculation Formulas

#### Formula A: Standard Percentile Score ($P$)
Represents the percentage of players equal to or below the current player's score:
$$P = \left( \frac{\text{TotalPlayers} - \text{Rank} + 1}{\text{TotalPlayers}} \right) \times 100$$

- **Properties**:
  - Rank 1 out of 100 players $\rightarrow P = \left(\frac{100 - 1 + 1}{100}\right) \times 100 = 100.0\%$
  - Rank 50 out of 100 players $\rightarrow P = \left(\frac{100 - 50 + 1}{100}\right) \times 100 = 51.0\%$
  - Rank 100 out of 100 players $\rightarrow P = \left(\frac{100 - 100 + 1}{100}\right) \times 100 = 1.0\%$

#### Formula B: Top Tier Percentage ($T$)
Represents the top percentile bracket (e.g., "Top 1%", "Top 5%"):
$$T = \left( \frac{\text{Rank}}{\text{TotalPlayers}} \right) \times 100$$

- **Properties**:
  - Rank 1 out of 100 players $\rightarrow T = \frac{1}{100} \times 100 = 1.0\%$ (Top 1%)
  - Rank 5 out of 100 players $\rightarrow T = \frac{5}{100} \times 100 = 5.0\%$ (Top 5%)

#### Edge Case Rules
1. **Single Player ($N=1$)**: `rank = 1`, `total = 1`. $P = 100.0\%$, $T = 100.0\%$ (or $0.0\%$).
2. **Unranked Player**: Return `rank: null`, `percentile: null`, `topPercentage: null`.
3. **Rounding**: All percentages should be rounded to 2 decimal places using `Number(val.toFixed(2))`.

---

## 5. Score Submission Synchronization (`api/score.ts`)

When a score submission is received at `POST /api/score`:
1. Parse `pubkey`, `mode` (default `arcade`), and `score`.
2. Determine active period keys for weekly (`YYYY-Www`) and daily (`YYYY-MM-DD`).
3. Update Redis keys:
   - `ZADD slashslice:leaderboard:<mode>:alltime score pubkey`
   - `ZADD slashslice:leaderboard:<mode>:weekly:<period> score pubkey`
   - `ZADD slashslice:leaderboard:<mode>:daily:<period> score pubkey`
4. Update user high score in `slashslice:user:<pubkey>`.
5. Maintain backward compatibility with legacy `slashslice:leaderboard_v2` for existing frontend components.

---

## 6. OpenAPI Documentation Status (`docs/API_REFERENCE.md`)

### Current State
`docs/API_REFERENCE.md` covers:
- Base Server URLs
- Security & Rate Limiting
- `GET /api/score` & `POST /api/score` (Legacy endpoints)
- `POST /api/mint` (Fungible score tokens)
- `POST /api/mint_nft` (Non-fungible cosmetic badges)

### Missing Endpoints
The following mandatory endpoints are completely absent from `docs/API_REFERENCE.md`:
1. `POST /api/user` — User registration & profile creation.
2. `GET /api/user` — User profile retrieval by pubkey or username.
3. `GET /api/leaderboard` — Multi-period paginated leaderboards.
4. `GET /api/leaderboard/rank` — Single-player rank & percentile retrieval.

### Action Plan for Documentation Worker
Add full OpenAPI 3.0 specification sections for `/api/user`, `/api/leaderboard`, and `/api/leaderboard/rank` in `docs/API_REFERENCE.md` with:
- Request/response JSON payloads
- cURL examples
- HTTP status codes (200, 400, 404, 405, 429, 500)
- Validation constraints
