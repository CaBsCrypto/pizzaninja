# Specification Probing & Test Requirements Report — Milestone 3 (`api/score.ts` & `StellarHub.tsx`)

## Overview

This report provides the complete specification probing, interface documentation, edge case analysis, and test requirement mapping for **Milestone 3 (Score Sync & UI Integration)** of Slash Slice Arena.

---

## 1. Observation

### Key Files Inspected
- `ORIGINAL_REQUEST.md`: R3 requires updating `api/score.ts` to sync score submissions with Redis ZSET keys (`slashslice:leaderboard:<mode>:alltime`, `weekly`, `daily` & `slashslice:user:<pubkey>`) and updating `StellarHub.tsx` to handle profile registration upon Web3 wallet login.
- `PROJECT.md`: Section Feature Inventory #5 & #6, Interface Contracts, Milestones table.
- `TEST_INFRA.md`: Full description of opaque-box E2E testing using `MockKvServer` and `TestServer`.
- `api/score.ts`: Lines 1-270. Implements ISO week (`getISOWeekString`), UTC date (`getUTCDateString`), CORS handling, GET legacy leaderboard, POST score handler (multi-period ZSET sync, high score preservation, user hash update, rank calculation, and Soroban fee-bump tx submission).
- `src/components/StellarHub.tsx`: Lines 1-663. Implements Web3 wallet login (Freighter, Passkey, Google/Privy SSO), profile check (`GET /api/user`), registration & edit modal (`POST /api/user`), and profile badge with high score stats.
- `tests/e2e/m3_score_sync_empirical.test.ts`: Lines 1-212. Empirical verification tests M3.1 through M3.5.
- `tests/empirical_m3_stress.test.ts`: Lines 1-249. Empirical edge case tests 1.1 through 1.6.
- `tests/e2e/tier1_features.test.ts`: Lines 352-466. Feature 5 tests 5.1 through 5.5.
- `tests/e2e/tier2_boundaries.test.ts`, `tier3_interactions.test.ts`, `tier4_realworld.test.ts`.

### Automated Test Execution Output
Command executed: `pnpm test` (running `npx tsx --test tests/e2e/*.test.ts`)
Result: **52/52 tests passing (0 failures)** across 16 test suites in 3.86 seconds.
Command executed: `npx tsx --test tests/empirical_m3_stress.test.ts`
Result: **6/6 tests passing (0 failures)** across 2 test suites in 2.23 seconds.

---

## 2. Logic Chain & Technical Specification Breakdown

### A. Multi-Period Score Sync Specification (`api/score.ts`)

#### 1. Redis Key Schema
- All-Time Leaderboard: `slashslice:leaderboard:<mode>:alltime` (ZSET, sorted by score DESC)
- Weekly ISO Leaderboard: `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>` (ZSET, e.g., `2026-W33`)
- Daily UTC Leaderboard: `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>` (ZSET, e.g., `2026-08-10`)
- Personal Best Tracker: `slashslice:scores:<identityKey>` (ZSET, mapping `selectedMode` to highest score)
- User Profile Metadata: `slashslice:user:<pubkey>` (JSON / Hash, containing `arcadeScore`, `classicScore`, `updatedAt`)
- Legacy Global Leaderboard: `slashslice:leaderboard_v2` (ZSET, top 20 global scores)

#### 2. Interface Definition: `POST /api/score`
- **Request Body**:
  ```json
  {
    "pubkey": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4",
    "name": "Ninja_Chef",
    "score": 1500,
    "mode": "arcade",
    "signedXdr": "AAAAA..."
  }
  ```
- **Inputs & Defaults**:
  - `pubkey` (optional string): Stellar ED25519 public key.
  - `name` (optional string): Player display name / guest identity.
  - `identityKey = pubkey || name`: At least one identity must be provided.
  - `score` (required number): Score value. Returns 400 if missing, null, or `isNaN(Number(score))`.
  - `mode` (optional string): `'arcade'` or `'classic'`. Defaults to `'arcade'` if missing or invalid.
  - `signedXdr` (optional string): Signed Soroban transaction XDR for optional on-chain fee-bump submission.

- **Response Payload (200 OK)**:
  ```json
  {
    "success": true,
    "updated": true,
    "score": 1500,
    "mode": "arcade",
    "rank": 1,
    "txHash": "TxA1B2C3D4GBRPSig"
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: `{ "success": false, "error": "Missing identity or score" }` (if score or identity missing)
  - `400 Bad Request`: `{ "success": false, "error": "Invalid score value" }` (if score is NaN)
  - `405 Method Not Allowed`: `{ "success": false, "error": "Method Not Allowed" }` (for PUT, DELETE, etc.)

#### 3. Update & Non-Downgrade Rules
1. **High Score Non-Downgrade**: When a new score is submitted, `api/score.ts` compares `numericScore` against the existing `zscore` in `slashslice:leaderboard:<mode>:alltime`.
2. If `numericScore > currentScore` (or `currentScore` is null):
   - Updates all-time ZSET (`zadd`).
   - Updates mode score tracking (`slashslice:scores:<identityKey>`).
   - Updates legacy global ZSET (`slashslice:leaderboard_v2`).
   - Sets `updated = true`.
3. If `numericScore <= currentScore`:
   - Does NOT modify all-time ZSET.
   - Sets `updated = false`.
4. **Weekly & Daily Independent Sync**: Syncs `numericScore` to `weekly` and `daily` ZSETs if `numericScore` exceeds existing score for that week/day.
5. **User Profile Sync**: If `pubkey` is provided and registered in `slashslice:user:<pubkey>`, updates `profileObj.arcadeScore` or `profileObj.classicScore` via `Math.max(existing, numericScore)` and refreshes `profileObj.updatedAt`.

---

### B. UI Profile Registration & Login Integration (`src/components/StellarHub.tsx`)

#### 1. Wallet Connectors Supported
- **Google / Gmail SSO (Privy)**: `login()` via `@privy-io/react-auth`. Derives deterministic Stellar keypair using `SHA-256(user.id + "_spicycrust_privy_shared_salt_2026")`. Sets `stellar_wallet` cookie for cross-app SSO.
- **Web3 Stellar Extension**: Freighter / Albedo / xBull via `@stellar/freighter-api` / `@stellar/wallet-sdk`.
- **Smart Wallet Passkey**: WebAuthn `navigator.credentials.create()`.

#### 2. Profile Check Lifecycle (`useEffect`)
- On wallet connection (`walletState.connected && walletState.publicKey`):
  - Calls `GET /api/user?pubkey=<publicKey>`.
  - **Registered (200 OK)**: Populates `userProfile` and `userStats` (`arcadeScore`, `classicScore`, `globalRank`), hides registration form.
  - **Unregistered (404 Not Found)**: Prompts user with inline registration form (`showRegisterForm = true`).

#### 3. Profile Registration & Editing Form
- **Fields**:
  - `username`: Required, 3 to 15 characters, regex `/^[a-zA-Z0-9_]{3,15}$/`.
  - `avatar`: Choice of `'ninja_default'` (🥷), `'chef_pizza'` (🍕), `'blade_master'` (⚔️), `'stellar_legend'` (👑).
- **Submission**:
  - Issues `POST /api/user` with `{ pubkey, username, avatar, privyDid }`.
  - On `201 Created`: Updates local state, closes modal, displays toast message `¡Perfil @<username> creado exitosamente! 🥷`.
  - On `409 Conflict`: Displays error `"Ese nombre de usuario ya está ocupado."`.
  - On Validation / Network Error: Displays error banner inside form.

---

## 3. Discovered Features & Edge Cases

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | API | Multi-Period Score Sync | Submits score to alltime, weekly ISO, and daily UTC ZSETs in Redis | `{ pubkey, name, score, mode, signedXdr }` | `{ success, updated, score, mode, rank, txHash }` | 400 if missing identity/score, 400 if NaN score | `api/score.ts` |
| 2 | API | Legacy Score Retrieval | Returns top 20 legacy global leaderboard entries | GET /api/score | JSON array of formatted score entries | 500 on KV failure | `api/score.ts` |
| 3 | API | User High Score Update | Updates `arcadeScore` / `classicScore` in `slashslice:user:<pubkey>` | `pubkey`, `numericScore`, `mode` | Updated Redis Hash/JSON | Ignored if user not registered | `api/score.ts` |
| 4 | API | Soroban Fee-Bump Tx | Submits fee-bumped Soroban transaction to Stellar testnet if signedXdr provided | `signedXdr`, `pubkey`, `ADMIN_SECRET_KEY` | `txHash` set to transaction hash | Logs warning & falls back to simulated txHash | `api/score.ts` |
| 5 | UI | SSO & Privy Key Derivation | Derives deterministic Stellar Keypair from Privy DID with SHA-256 | `user.id` from Privy | `stellar_wallet` cookie + `StellarWalletState` | Silent error log on failure | `StellarHub.tsx` |
| 6 | UI | Automatic Profile Detection | Fetches profile on wallet connect via `GET /api/user` | `pubkey` | Sets `userProfile` or opens registration form | Falls back to registration form | `StellarHub.tsx` |
| 7 | UI | Profile Registration & Edit Modal | Form for registering/updating username & avatar | `{ pubkey, username, avatar, privyDid }` | Call `POST /api/user`, update state | Displays inline error banner (e.g. 409 conflict) | `StellarHub.tsx` |

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Score Sync | Missing both `pubkey` and `name` | Returns status 400 `{ success: false, error: "Missing identity or score" }` |
| 2 | Score Sync | `score: "invalid_str"` or `score: null` | Returns status 400 `{ success: false, error: "Invalid score value" }` or missing identity/score error |
| 3 | Score Sync | Lower score submitted (e.g. 300 after 1500) | Returns status 200 `{ updated: false, score: 300 }`, all-time high score preserved at 1500 |
| 4 | Score Sync | Score = 0 or negative score on fresh user | Returns status 200 `{ updated: true }`, zero/negative stored in ZSET |
| 5 | Score Sync | Unregistered user submits score | Score stored in ZSETs under pubkey; subsequent profile registration connects stats |
| 6 | Score Sync | Invalid mode parameter (e.g., `mode: "survival"`) | Defaults to `'arcade'` mode without throwing error |
| 7 | User UI Form | Username containing space or emoji | Rejected client-side before fetch, or returns 400 from `POST /api/user` |
| 8 | User UI Form | Duplicate username attempt | Returns 409 from `POST /api/user`, UI shows "Ese nombre de usuario ya está ocupado." |

---

## 4. Caveats
- No files outside `.agents/explorer_m3_3_gen2/` were created or modified during this exploration phase (strictly read-only).
- Soroban fee-bump transaction submission depends on `ADMIN_SECRET_KEY` env var; when absent, `api/score.ts` safely defaults to simulated `txHash`.
- Mock KV test infrastructure (`mockKvServer.ts`) accurately mirrors Vercel KV Redis behavior for ZSETs, Hashes, and String keys.

---

## 5. Conclusion

Milestone 3 requirements for `api/score.ts` and `StellarHub.tsx` are fully specified and tested.
- `api/score.ts` correctly handles multi-period Redis ZSET synchronization (`alltime`, `weekly`, `daily`), high score non-downgrade logic, user profile sync, exact rank retrieval, and legacy global leaderboard compatibility.
- `StellarHub.tsx` seamlessly integrates Web3 wallet authentication, automatic profile detection via `GET /api/user`, registration and edit form modal (`POST /api/user`), and user stats display.
- Existing test suites (`tests/e2e/m3_score_sync_empirical.test.ts`, `tests/empirical_m3_stress.test.ts`, and Tiers 1-4) provide **100% pass rate across 58 total test assertions**.

---

## 6. Verification Method

To independently verify all specification requirements and test cases:

```bash
# 1. Run all E2E test suites (Tier 1-4 + M3 Empirical)
pnpm test

# 2. Run empirical M3 stress & edge case suite directly
npx tsx --test tests/empirical_m3_stress.test.ts

# 3. Verify TypeScript build compilation
pnpm build
```
