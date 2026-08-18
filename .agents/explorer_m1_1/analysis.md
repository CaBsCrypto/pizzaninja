# Technical Specification & Implementation Plan: User Registration & Profile API (`/api/user.ts`)

**Milestone**: Milestone 1 (User Registration & Profile API)  
**Author**: Explorer 1  
**Target File**: `api/user.ts`  
**Date**: 2026-08-10  

---

## 1. Overview & Scope

The `/api/user.ts` endpoint provides serverless User Registration (`POST`) and User Profile & Stats Retrieval (`GET`) backed by Vercel KV (Redis). It establishes identity management for Slash Slice Arena by associating Stellar public keys with unique display usernames, optional avatars, and Privy DIDs.

---

## 2. Serverless Function & Compatibility Pattern

### Handler Signature
To ensure compatibility with Vercel's Node.js Serverless runtime (standard for `api/*.ts`) as well as Web Standard Fetch `Request`/`Response` runtimes, the handler will implement a standard Vercel Node handler with optional Web API fallbacks:

```typescript
import { kv } from '@vercel/kv';

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = kv as any;
  ...
}
```

---

## 3. Data Validation & Regex Specifications

### Stellar Public Key Validation
- **Regex**: `/^G[A-Z2-7]{55}$/`
- **Rules**:
  - Must start with uppercase letter `'G'`.
  - Followed by exactly 55 Base32 characters (`A-Z`, `2-7`).
  - Total length: exactly 56 characters.

### Username Validation & Case Normalization
- **Regex**: `/^[a-zA-Z0-9_]{3,15}$/`
- **Rules**:
  - Length: 3 to 15 characters.
  - Allowed characters: alphanumeric (`a-z`, `A-Z`, `0-9`) and underscore (`_`).
  - Display case is preserved in the user profile object (e.g., `"Ninja_Master"`).
  - Uniqueness checking is case-insensitive using normalized lowercase string (`"ninja_master"`).

---

## 4. Vercel KV Data Schema & Redis Key Indexing

### Key Structures
1. **User Profile Hash**: `slashslice:user:<pubkey>`
   - Type: Hash / JSON Object
   - Fields:
     - `pubkey`: string (Stellar address `G...`)
     - `username`: string (Original display case)
     - `avatar`: string (URL or empty string if not provided)
     - `privyDid`: string (Privy DID identifier or empty string)
     - `createdAt`: ISO 8601 timestamp string (`new Date().toISOString()`)
     - `updatedAt`: ISO 8601 timestamp string (`new Date().toISOString()`)

2. **Username Uniqueness Index**: `slashslice:username:<normalized_username>`
   - Type: String key storing `<pubkey>`
   - Key generation: `normalized_username = username.toLowerCase()`
   - Index format: `slashslice:username:${normalized_username}`
   - Purpose: Quick O(1) case-insensitive lookup to check username availability and prevent collisions.

3. **Privy DID Index (Reverse Lookup)**: `slashslice:privy:<privyDid>`
   - Type: String key storing `<pubkey>`
   - Format: `slashslice:privy:${privyDid}`
   - Purpose: Maps Privy user DID to Stellar public key for authentication & wallet lookup.

4. **Leaderboard & User Stats Integration**:
   - `slashslice:scores:<pubkey>` (ZSET storing mode scores e.g. `arcade`, `classic`)
   - `slashslice:leaderboard:arcade:alltime` (ZSET) & `slashslice:leaderboard_v2` (ZSET)
   - Used during `GET /api/user` to compute `arcadeScore`, `classicScore`, and `globalRank`.

---

## 5. API Endpoint Specifications

### 5.1 `POST /api/user` — User Registration & Profile Update

#### Workflow Logic:
1. Parse body from `req.body` (or `await req.json()`).
2. Validate `pubkey`: Must be non-empty string matching `/^G[A-Z2-7]{55}$/`. If invalid -> 400 Bad Request.
3. Validate `username`: Must be non-empty string matching `/^[a-zA-Z0-9_]{3,15}$/`. If invalid -> 400 Bad Request.
4. Normalize username: `normalized = username.toLowerCase()`.
5. Check Username Uniqueness:
   - Query `existingPubkey = await client.get('slashslice:username:' + normalized)`.
   - If `existingPubkey` exists AND `existingPubkey !== pubkey`:
     - Return **409 Conflict**: `{ success: false, error: 'Username already taken' }`.
6. Handle Profile Creation / Update:
   - Query existing user profile `slashslice:user:<pubkey>`.
   - If user already exists:
     - Retain original `createdAt`.
     - If previous username exists and `oldNormalized !== normalized`:
       - Delete old index key `await client.del('slashslice:username:' + oldNormalized)`.
   - If new user:
     - Set `createdAt = new Date().toISOString()`.
   - Set `updatedAt = new Date().toISOString()`.
7. Write to Vercel KV:
   - Store profile object to `slashslice:user:<pubkey>` via `client.hset` (or `client.set`).
   - Store username index: `await client.set('slashslice:username:' + normalized, pubkey)`.
   - If `privyDid` provided: store `await client.set('slashslice:privy:' + privyDid, pubkey)`.
8. Return **201 Created**:
   ```json
   {
     "success": true,
     "user": {
       "pubkey": "GAYX4B7K...92L",
       "username": "Ninja_Master",
       "avatar": "https://example.com/avatar.png",
       "privyDid": "did:privy:123456",
       "createdAt": "2026-08-10T20:22:34.000Z",
       "updatedAt": "2026-08-10T20:22:34.000Z"
     }
   }
   ```

---

### 5.2 `GET /api/user` — Profile & Stats Retrieval

#### Workflow Logic:
1. Parse query parameters `pubkey` and `username` from `req.query` (or request URL).
2. If neither `pubkey` nor `username` is provided (or if both are missing):
   - Return **400 Bad Request**: `{ success: false, error: 'pubkey or username parameter is required' }`.
3. Resolve `targetPubkey`:
   - If `pubkey` is supplied, validate format `/^G[A-Z2-7]{55}$/`. If invalid -> 400 Bad Request. Set `targetPubkey = pubkey`.
   - If `username` is supplied (and no `pubkey`), normalize `normalized = username.toLowerCase()`. Query `targetPubkey = await client.get('slashslice:username:' + normalized)`. If null -> Return **404 Not Found**: `{ success: false, error: 'User not found' }`.
4. Fetch Profile:
   - Query user profile from `slashslice:user:<targetPubkey>`.
   - If null/empty -> Return **404 Not Found**: `{ success: false, error: 'User not found' }`.
5. Fetch User Stats & Global Rank:
   - Query `arcadeScore`: `await client.zscore('slashslice:scores:' + targetPubkey, 'arcade')` or from `slashslice:leaderboard:arcade:alltime`. Default to `0`.
   - Query `classicScore`: `await client.zscore('slashslice:scores:' + targetPubkey, 'classic')` or from `slashslice:leaderboard:classic:alltime`. Default to `0`.
   - Query `globalRank`: `rankZero = await client.zrevrank('slashslice:leaderboard:arcade:alltime', targetPubkey)`. If `rankZero !== null` -> `globalRank = rankZero + 1`. Fallback check `slashslice:leaderboard_v2` if primary ZSET is empty. If unranked -> `globalRank = null`.
6. Return **200 OK**:
   ```json
   {
     "success": true,
     "user": {
       "pubkey": "GAYX4B7K...92L",
       "username": "Ninja_Master",
       "avatar": "https://example.com/avatar.png",
       "privyDid": "did:privy:123456",
       "createdAt": "2026-08-10T20:22:34.000Z",
       "updatedAt": "2026-08-10T20:22:34.000Z"
     },
     "stats": {
       "arcadeScore": 420,
       "classicScore": 380,
       "globalRank": 1
     }
   }
   ```

---

## 6. Error Response Summary Matrix

| Scenario | HTTP Status Code | Response Payload |
| :--- | :--- | :--- |
| **Invalid Pubkey Format** | `400 Bad Request` | `{ "success": false, "error": "Invalid Stellar public key format" }` |
| **Invalid Username Format** | `400 Bad Request` | `{ "success": false, "error": "Invalid username. Must be 3-15 alphanumeric characters or underscores." }` |
| **Missing Required Query/Body** | `400 Bad Request` | `{ "success": false, "error": "Missing required fields" }` |
| **Username Already Claimed** | `409 Conflict` | `{ "success": false, "error": "Username already taken" }` |
| **User Profile Not Found** | `404 Not Found` | `{ "success": false, "error": "User not found" }` |
| **Unsupported HTTP Method** | `405 Method Not Allowed` | `{ "success": false, "error": "Method Not Allowed" }` |
| **Vercel KV / Redis Error** | `500 Internal Error` | `{ "success": false, "error": "Internal server error" }` |

---

## 7. Implementation Plan for Implementer Agent

1. Create `api/user.ts`.
2. Import `{ kv }` from `@vercel/kv`.
3. Define types `UserProfile`, `UserStats`, `UserResponse`.
4. Implement input validation helpers (`isValidPubkey`, `isValidUsername`).
5. Build handler logic for `OPTIONS`, `POST`, `GET`, and fallback `405 Method Not Allowed`.
6. Implement error handling with try/catch wrapping KV calls, defaulting gracefully if KV is unavailable during local dev.
7. Verify build using `pnpm build` (`npx tsx copy-mediapipe-assets.js && vite build`).
