# Milestone 1: User Registration & Profile API (`/api/user`) — Deep Investigation & Edge-Case Analysis

## Executive Summary
This document presents the detailed architectural and edge-case analysis for **Milestone 1 (User Registration & Profile API)** of the Slash Slice Arena project. The analysis covers the specifications for `POST /api/user` and `GET /api/user` using `@vercel/kv` (Redis), focus areas including atomic username uniqueness indexing, Privy DID reverse lookup, profile retrieval by public key or username, and high score/rank inclusion (`arcadeScore`, `classicScore`, `globalRank`).

---

## 1. Architectural & Redis Key Schema Overview

The user profile subsystem relies on Vercel KV (`@vercel/kv`) with three primary key patterns:

| Redis Key Pattern | Redis Data Type | Value / Structure | Purpose |
|-------------------|-----------------|-------------------|---------|
| `slashslice:user:<pubkey>` | Hash | `{ pubkey, username, avatar, privyDid, createdAt, updatedAt }` | Canonical user profile metadata |
| `slashslice:username:<normalized>` | String | `<pubkey>` | Case-insensitive uniqueness index mapping normalized username to pubkey |
| `slashslice:privy:<privyDid>` | String | `<pubkey>` | Reverse lookup mapping Privy DID to pubkey |

### Leaderboard & Score Keys (Referenced for `GET /api/user` stats)
| Redis Key Pattern | Redis Data Type | Member | Score | Purpose |
|-------------------|-----------------|--------|-------|---------|
| `slashslice:leaderboard:arcade:alltime` | ZSET | `<pubkey>` | score | Arcade mode all-time scores |
| `slashslice:leaderboard:classic:alltime` | ZSET | `<pubkey>` | score | Classic mode all-time scores |
| `slashslice:scores:<pubkey>` | ZSET | `arcade` / `classic` | score | Legacy score store per user/mode |

---

## 2. Deep-Dive: Atomic Username Registration & Edge Cases (`POST /api/user`)

### 2.1 Input Validation Rules
- **Stellar Public Key (`pubkey`)**:
  - Format Regex: `/^G[A-Z2-7]{55}$/` (56 chars, base32 RFC4648 without padding starting with 'G').
  - Failure Response: `400 Bad Request` with `{ success: false, error: "Invalid Stellar public key format" }`.
- **Username (`username`)**:
  - Format Regex: `/^[a-zA-Z0-9_]{3,15}$/` (3 to 15 alphanumeric characters or underscore).
  - Preserved Casing: Stored as provided by the user in `slashslice:user:<pubkey>` hash (e.g. `"Pizza_Ninja"`).
  - Normalized Casing: Lower-cased (`username.toLowerCase()`) for index key `slashslice:username:<normalized>` (e.g. `"pizza_ninja"`).
  - Failure Response: `400 Bad Request` with `{ success: false, error: "Invalid username format. Must be 3-15 alphanumeric characters or underscore." }`.
- **Optional Fields**:
  - `avatar?: string` (URL string; default to empty string `""` or standard fallback if omitted).
  - `privyDid?: string` (Privy DID string e.g. `"did:privy:..."`).

### 2.2 Race Conditions & Atomic Registration Strategy
A common mistake in username uniqueness enforcement is the non-atomic check:
1. `GET slashslice:username:<normalized>`
2. If `null`, `SET slashslice:username:<normalized> <pubkey>`

**Failure Mode**: Under high concurrency, two requests for the same username from different pubkeys can both read `null` simultaneously and attempt `SET`, causing one request to silently overwrite the other and corrupting the index.

**Atomic Strategy Solution**:
1. Check existing username owner:
   ```ts
   const normalized = username.toLowerCase();
   const existingOwner = await client.get<string>(`slashslice:username:${normalized}`);
   ```
2. **Owner Matching & Conflict Check**:
   - If `existingOwner` exists and `existingOwner !== pubkey`:
     Return `409 Conflict` (`{ success: false, error: "Username already taken" }`).
   - If `existingOwner` exists and `existingOwner === pubkey`:
     User is re-registering or updating their profile with their existing username. Proceed with update.
   - If `existingOwner` does **NOT** exist:
     Use atomic `SETNX` (via `@vercel/kv` `client.set(key, value, { nx: true })`):
     ```ts
     const claimed = await client.set(`slashslice:username:${normalized}`, pubkey, { nx: true });
     if (!claimed) {
       // Concurrent request claimed the username in the millisecond between GET and SETNX
       return res.status(409).json({ success: false, error: "Username already taken" });
     }
     ```

### 2.3 Profile Updates & Username Modification Edge Cases

| Scenario | Situation | Handling Strategy |
|----------|-----------|-------------------|
| **First-time Registration** | Pubkey does not exist, username is free | `SETNX` username index, create `slashslice:user:<pubkey>` hash with `createdAt = updatedAt = ISO string`. If `privyDid` provided, set `slashslice:privy:<privyDid>`. |
| **Profile Update (Same Username)** | Pubkey exists, username unchanged | `existingOwner === pubkey`. Update hash `slashslice:user:<pubkey>` fields (`avatar`, `privyDid`, `updatedAt = ISO string`). Retain original `createdAt`. |
| **Username Change** | Pubkey exists, user changes username from `old_user` to `new_user` | 1. Claim `new_user` index via `SETNX`. If taken by someone else, return 409.<br>2. Delete old index key `slashslice:username:<old_normalized>`.<br>3. Update profile hash with new username and `updatedAt`. |
| **Reclaiming Owned Username** | User changes to `new_user` then changes back to `old_user` | Handled properly because `old_user` index was deleted on change, making it available for reclaim. |

### 2.4 Transactional Consistency with Redis Pipeline
To prevent partial writes (e.g. username index set, but profile hash write fails), use `@vercel/kv` pipeline:
```ts
const pipeline = client.pipeline();
pipeline.hset(`slashslice:user:${pubkey}`, profileData);
if (oldNormalized && oldNormalized !== normalized) {
  pipeline.del(`slashslice:username:${oldNormalized}`);
}
if (privyDid) {
  pipeline.set(`slashslice:privy:${privyDid}`, pubkey);
}
await pipeline.exec();
```

---

## 3. Reverse Lookups (`slashslice:privy:<privyDid>`)

### 3.1 Functionality & Workflow
When `POST /api/user` receives a `privyDid` field:
1. Map `slashslice:privy:<privyDid>` -> `<pubkey>` (String key).
2. Store `privyDid` inside `slashslice:user:<pubkey>` Hash.

### 3.2 Edge Cases & Resolution
1. **Privy DID Re-assignment / Account Collision**:
   - If `privyDid` is already mapped to `pubkeyB` (where `pubkeyB !== pubkeyA`):
     - In Privy Web3 Auth, a Privy DID is uniquely tied to an authenticated account.
     - If a request attempts to bind an already registered `privyDid` to a new `pubkeyA`, update `slashslice:privy:<privyDid>` to point to `pubkeyA`, or clean up `pubkeyB`'s profile hash if required.
2. **Changing / Clearing `privyDid`**:
   - If an existing profile had `oldPrivyDid` and user updates to `newPrivyDid`, remove `slashslice:privy:<oldPrivyDid>`.
   - If `privyDid` parameter is `undefined` in request body, preserve the user's existing `privyDid`.

---

## 4. Profile Retrieval Logic (`GET /api/user`)

### 4.1 Parameter Validation & Priority
- Accepted Query Parameters: `pubkey` OR `username`.
- Resolution Flow:
  1. If neither `pubkey` nor `username` is provided:
     Return `400 Bad Request` (`{ success: false, error: "Missing pubkey or username parameter" }`).
  2. If `pubkey` is provided:
     - Validate format `/^G[A-Z2-7]{55}$/`. If invalid, return `400 Bad Request`.
     - Target pubkey = `pubkey`.
  3. If `pubkey` is missing but `username` is provided:
     - Validate format `/^[a-zA-Z0-9_]{3,15}$/`. If invalid, return `400 Bad Request`.
     - Normalize: `normalized = username.toLowerCase()`.
     - Index Lookup: `const mappedPubkey = await client.get<string>(`slashslice:username:${normalized}`);`
     - If `!mappedPubkey`: Return `404 Not Found` (`{ success: false, error: "User not found" }`).
     - Target pubkey = `mappedPubkey`.

### 4.2 Fetching Hash Profile
Execute `client.hgetall(`slashslice:user:${targetPubkey}`)`:
- If `!userProfile || Object.keys(userProfile).length === 0`:
  Return `404 Not Found` (`{ success: false, error: "User not found" }`).

---

## 5. High Scores & Rank Inclusion (`arcadeScore`, `classicScore`, `globalRank`)

### 5.1 Stats Fetching Specification

```ts
// 1. Arcade High Score
let arcadeScore = await client.zscore('slashslice:leaderboard:arcade:alltime', targetPubkey);
if (arcadeScore === null) {
  // Legacy fallback check
  arcadeScore = await client.zscore(`slashslice:scores:${targetPubkey}`, 'arcade');
}
const finalArcadeScore = arcadeScore !== null ? Number(arcadeScore) : 0;

// 2. Classic High Score
let classicScore = await client.zscore('slashslice:leaderboard:classic:alltime', targetPubkey);
if (classicScore === null) {
  // Legacy fallback check
  classicScore = await client.zscore(`slashslice:scores:${targetPubkey}`, 'classic');
}
const finalClassicScore = classicScore !== null ? Number(classicScore) : 0;

// 3. Global Rank Calculation (1-based index in Arcade All-Time Leaderboard)
const zeroBasedRank = await client.zrevrank('slashslice:leaderboard:arcade:alltime', targetPubkey);
const globalRank = (zeroBasedRank !== null && zeroBasedRank !== undefined)
  ? zeroBasedRank + 1
  : null;
```

### 5.2 Response Schema Contract
```json
{
  "success": true,
  "user": {
    "pubkey": "GA7Q24...EXAMPLE...",
    "username": "PizzaNinja",
    "avatar": "https://example.com/avatar.png",
    "privyDid": "did:privy:12345",
    "createdAt": "2026-08-10T20:00:00.000Z",
    "updatedAt": "2026-08-10T20:00:00.000Z"
  },
  "stats": {
    "arcadeScore": 1500,
    "classicScore": 800,
    "globalRank": 1
  }
}
```

---

## 6. Comprehensive Verification & Edge Case Matrix

| ID | Test Case / Condition | Input | Expected HTTP Status | Expected Response / KV State |
|----|-----------------------|-------|----------------------|------------------------------|
| **TC1** | Valid POST User Registration | `{ pubkey: "G...", username: "Ninja" }` | `201 Created` | Profile stored in `slashslice:user:G...`, index set in `slashslice:username:ninja`. |
| **TC2** | Duplicate Username Registration | `{ pubkey: "G_OTHER...", username: "Ninja" }` | `409 Conflict` | `{ success: false, error: "Username already taken" }`. Index untouched. |
| **TC3** | Re-registering / Updating Same User | Same `pubkey` + Same `username` with new avatar | `200 OK` or `201 Created` | Profile updated, `updatedAt` refreshed, `createdAt` preserved. |
| **TC4** | Username Case Sensitivity Check | Reg `"Ninja"`, query GET `username=ninja` | `200 OK` | Username resolved via normalized index `slashslice:username:ninja`, returns `user.username = "Ninja"`. |
| **TC5** | Invalid Pubkey Format | `{ pubkey: "INVALID", username: "Ninja" }` | `400 Bad Request` | `{ success: false, error: "Invalid Stellar public key format" }` |
| **TC6** | Invalid Username Format | `{ pubkey: "G...", username: "a" }` (too short) | `400 Bad Request` | `{ success: false, error: "Invalid username format..." }` |
| **TC7** | GET User by Pubkey | `GET /api/user?pubkey=G...` | `200 OK` | Returns `user` object + `stats: { arcadeScore, classicScore, globalRank }`. |
| **TC8** | GET User by Username | `GET /api/user?username=Ninja` | `200 OK` | Looks up index `slashslice:username:ninja` -> fetches `slashslice:user:G...`. |
| **TC9** | GET Non-existent User | `GET /api/user?username=nonexistent` | `404 Not Found` | `{ success: false, error: "User not found" }` |
| **TC10**| GET User with No Scores | Valid registered pubkey with 0 leaderboard entries | `200 OK` | `stats: { arcadeScore: 0, classicScore: 0, globalRank: null }` |

---
*Analysis prepared by Explorer 2 for Milestone 1.*
