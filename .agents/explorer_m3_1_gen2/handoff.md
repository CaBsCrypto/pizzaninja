# Handoff Report: Score Submission & Multi-Period Leaderboard Sync Investigation

## 1. Observation

### 1.1 Source Files Examined
- **`api/score.ts`**: Lines 5-20 (Date/Week string helpers), Lines 89-192 (Score POST handler, Redis ZSET multi-period sync, and User profile high score updates).
- **`api/user.ts`**: Lines 115-127 (User profile registration/update in `POST /api/user`), Lines 196-206 (Score retrieval in `GET /api/user`).
- **`api/leaderboard.ts`**: Lines 6-21 (ISO week & date helpers), Lines 228-246 (Key construction for `alltime`, `weekly`, `daily` ZSETs), Lines 288-306 (User profile metadata lookup for entries).
- **`api/leaderboard/rank.ts`**: Lines 178-194 (Key resolution for rank calculation), Lines 230-245 (User metadata lookup).
- **`tests/empirical_m3_stress.test.ts`**: Lines 22-247 (Empirical stress tests for missing fields, invalid scores, zero/negative scores, high score preservation, unregistered users, and mode fallbacks).
- **`tests/e2e/m3_score_sync_empirical.test.ts`**: Lines 32-210 (E2E verification of multi-period ZSET sync, high score preservation, mode independence, and guest submissions).

### 1.2 Multi-Period Redis ZSET Key Specifications
- **All-Time Leaderboard Key**: `slashslice:leaderboard:<mode>:alltime`
- **Weekly Leaderboard Key**: `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>`
- **Daily Leaderboard Key**: `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>`
- `<mode>` values: `'arcade'` | `'classic'` (defaults to `'arcade'`).
- `YYYY-Www` format generated via `getISOWeekString()` (e.g., `2026-W33`).
- `YYYY-MM-DD` format generated via `getUTCDateString()` (e.g., `2026-08-11`).

### 1.3 User Profile Hash Key Specifications
- **User Profile Key**: `slashslice:user:<pubkey>`
- **Storage Format**: Dual-persistence using Redis string (`JSON.stringify(profileObj)`) via `client.set` and Redis Hash via `client.hset`.
- **High Score Fields**: `arcadeScore` (number) and `classicScore` (number).

---

## 2. Logic Chain

### 2.1 Score Submission Workflow in `api/score.ts`
1. **Input Normalization**:
   - `score` is validated as a non-null, finite number (`Number(score)`).
   - `selectedMode` defaults to `'arcade'` if not explicitly set to `'classic'`.
   - `identityKey` is set to `pubkey || name`.

2. **ZSET Multi-Period Synchronization**:
   - Calculates target keys for the current timestamp: `alltimeKey`, `weeklyKey`, `dailyKey`.
   - Queries `zscore` for each key.
   - Updates ZSET via `client.zadd(key, { score: numericScore, member: identityKey })` if `currentScore === null` or `numericScore > Number(currentScore)`.
   - This ensures new scores update the ZSET, while lower scores do not overwrite higher personal bests.

3. **User Profile High Score Update (`slashslice:user:<pubkey>`)**:
   - If `pubkey` is present, retrieves existing user profile from `slashslice:user:<pubkey>`.
   - If profile exists:
     - Updates `arcadeScore` (if mode is `arcade`) or `classicScore` (if mode is `classic`) using `Math.max(existingScore, numericScore)`.
     - Updates `updatedAt` timestamp.
     - Saves profile back to Redis hash and string keys.

### 2.2 Critical Findings & Edge Cases Identified

1. **Bug / Defect in `api/user.ts` (Profile Registration / Update High Score Wipeout)**:
   - **Observation**: In `api/user.ts` (lines 115-127), when a user calls `POST /api/user` to register or update their profile, the handler constructs `const profile = { pubkey, username, avatar, privyDid, createdAt, updatedAt }` WITHOUT `arcadeScore` or `classicScore`.
   - **Impact**: If a user had already accumulated high scores via `api/score.ts` before calling `POST /api/user`, or if an existing user updates their profile metadata (e.g., username/avatar), `POST /api/user` replaces `slashslice:user:<pubkey>` with a JSON object that lacks `arcadeScore` and `classicScore`.
   - **Root Cause**: Missing preservation of `arcadeScore`/`classicScore` from `existingProfile` and missing backfill from Redis ZSET keys `slashslice:leaderboard:arcade:alltime` / `slashslice:leaderboard:classic:alltime`.

2. **Unregistered User Pre-Registration Score Submissions**:
   - **Observation**: When an unregistered user (a pubkey that has not called `POST /api/user`) submits scores via `POST /api/score`, the score is correctly saved to ZSET keys (`slashslice:leaderboard:<mode>:alltime`). However, no profile hash exists in `slashslice:user:<pubkey>`.
   - **Impact**: If the user registers later via `POST /api/user`, their initial user profile hash won't have `arcadeScore`/`classicScore` initialized unless `api/user.ts` checks the ZSET keys during profile creation.

3. **Zero and Negative Score Submissions**:
   - **Observation**: The condition `currentScore === null || currentScore === undefined || numericScore > Number(currentScore)` evaluates to `true` when a player submits 0 or negative scores on their very first game.
   - **Impact**: Initial 0 or negative scores are recorded properly in all ZSET keys, but subsequent lower scores will not downgrade an established higher score.

---

## 3. Implementation Strategy & Remediation Plan

### Step 1: Fix `api/user.ts` Profile Registration & Metadata Updates
Update `POST /api/user` handler in `api/user.ts`:
1. Fetch existing high scores for `arcade` and `classic` modes from ZSET keys (`slashslice:leaderboard:arcade:alltime` and `slashslice:leaderboard:classic:alltime`) for `pubkey`.
2. Construct the user profile object preserving high scores:
   ```typescript
   const arcadeScoreFromZset = await client.zscore('slashslice:leaderboard:arcade:alltime', pubkey);
   const classicScoreFromZset = await client.zscore('slashslice:leaderboard:classic:alltime', pubkey);

   const profile = {
     pubkey,
     username,
     avatar: validAvatar || (typeof existingProfile?.avatar === 'string' ? existingProfile.avatar : 'default'),
     privyDid: newPrivyDid,
     arcadeScore: Math.max(Number(existingProfile?.arcadeScore || 0), arcadeScoreFromZset !== null ? Number(arcadeScoreFromZset) : 0),
     classicScore: Math.max(Number(existingProfile?.classicScore || 0), classicScoreFromZset !== null ? Number(classicScoreFromZset) : 0),
     createdAt: existingProfile?.createdAt || now,
     updatedAt: now
   };
   ```
3. Store `profile` in `slashslice:user:<pubkey>` via both `client.set` and `client.hset`.

### Step 2: Reinforce High Score Maintenance in `api/score.ts`
1. When `POST /api/score` executes for a `pubkey`:
   - If profile exists in `slashslice:user:<pubkey>`, update `arcadeScore` / `classicScore` on the profile object and preserve both fields.
   - Ensure both `arcadeScore` and `classicScore` fields are present in the hash/object written to `slashslice:user:<pubkey>`.

---

## 4. Caveats

- **Timezone Standard**: Multi-period leaderboard keys (`weekly` and `daily`) strictly rely on UTC dates (`getISOWeekString` & `getUTCDateString`). All server instances must compute dates based on UTC to avoid key divergence around midnight.
- **Guest / Anonymous Submissions**: Submissions with only `name` (no `pubkey`) write to ZSET keys using `name` as member, but cannot write to `slashslice:user:<pubkey>` since guest users do not possess a Stellar public key.

---

## 5. Conclusion

The current score submission pipeline in `api/score.ts` correctly handles multi-period Redis ZSET synchronization across `alltime`, `weekly`, and `daily` timeframes for `arcade` and `classic` modes. However, a key gap exists in `api/user.ts` where profile creation and updates overwrite the profile object in `slashslice:user:<pubkey>` without retaining or backfilling `arcadeScore` and `classicScore`. Implementing the proposed fix in `api/user.ts` will guarantee complete data consistency between Redis ZSET leaderboards and user profile hashes.

---

## 6. Verification Method

To verify the investigation findings and proposed fix strategy:
1. Run empirical stress tests:
   ```bash
   node --test tests/empirical_m3_stress.test.ts
   ```
2. Run E2E score sync tests:
   ```bash
   node --test tests/e2e/m3_score_sync_empirical.test.ts
   ```
3. Perform manual verification:
   - Register a user via `POST /api/user`.
   - Submit scores via `POST /api/score` for arcade and classic modes.
   - Verify Redis keys `slashslice:leaderboard:<mode>:alltime`, `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>`, `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>`, and `slashslice:user:<pubkey>` contain accurate high scores.
