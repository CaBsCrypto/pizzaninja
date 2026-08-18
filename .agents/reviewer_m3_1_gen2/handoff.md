# Handoff Report: Review & Verification of Milestone 3

## 1. Observation

### 1.1 Command Execution Results
1. **`pnpm build`**:
   - Exit code: `0`
   - Outcome: Clean production build with Vite, bundling all client components and serverless endpoints.
2. **`pnpm test`**:
   - Exit code: `1`
   - Outcome: **80 / 82 tests passing, 2 failures** in `tests/e2e/m3_gen2_empirical_stress.test.ts`.

### 1.2 Specific Verbatim Test Failure Outputs

```
✖ 4.1 Guest score submission with name only populates ZSET and leaderboard (118.9745ms)
  AssertionError [ERR_ASSERTION]: Guest entry should be present in leaderboard
      at TestContext.<anonymous> (C:\Users\MGC\Documents\antigravity\blissful-hawking\tests\e2e\m3_gen2_empirical_stress.test.ts:188:14)

✖ 5.1 Concurrent score submissions for the same user resolves to max score (463.6032ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  800 !== 1500
  
      at TestContext.<anonymous> (C:\Users\MGC\Documents\antigravity\blissful-hawking\tests\e2e\m3_gen2_empirical_stress.test.ts:233:14)
```

### 1.3 Code Inspection Observations

1. **`api/score.ts` (Lines 112-145)**:
   ```ts
   let currentScore = await client.zscore(alltimeKey, identityKey);
   if (currentScore === null || currentScore === undefined) {
     currentScore = await client.zscore(userScoresKey, selectedMode);
   }

   let updated = false;
   if (currentScore === null || currentScore === undefined || numericScore > Number(currentScore)) {
     updated = true;
     await client.zadd(alltimeKey, { score: numericScore, member: identityKey });
     await client.zadd(userScoresKey, { score: numericScore, member: selectedMode });
     // ...
   }
   ```
   - *Issue*: Non-atomic read-then-write (`zscore` followed by `zadd`). Under concurrent submissions, multiple requests read `currentScore` simultaneously before any write occurs. The request that finishes writing last overwrites the ZSET value, even if its score is lower than a preceding concurrent submission (e.g., 800 overwriting 1500).

2. **`api/leaderboard.ts` (Lines 97-156, `resolvePubkeyFromRedis`)**:
   ```ts
   // Fallback 1: Check slashslice:leaderboard_v2 ZSET records
   try {
     const legacyRecords = await client.zrange('slashslice:leaderboard_v2', 0, -1);
     if (Array.isArray(legacyRecords)) {
       for (const recStr of legacyRecords) {
         try {
           const rec = typeof recStr === 'string' ? JSON.parse(recStr) : recStr;
           if (rec && Number(rec.score) === score && (rec.mode || 'arcade') === mode && rec.pubkey && STELLAR_PUBKEY_REGEX.test(cleanPubkey(rec.pubkey))) {
             return cleanPubkey(rec.pubkey);
           }
         } catch (e) {}
       }
     }
   } catch (e) {}
   ```
   - *Issue*: Matches ANY entry in `slashslice:leaderboard_v2` with matching `score` and `mode`, ignoring `rec.name` or `rec.pubkey`. If a guest user submits a score equal to a registered user's score (e.g. 1800), `resolvePubkeyFromRedis` incorrectly returns the registered user's pubkey, assigning guest scores to arbitrary registered players.

3. **`api/leaderboard.ts` (Line 305)**:
   ```ts
   const username = cleanUsername(userObj.username) || (pubkey.length > 10 ? `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}` : 'Anonymous');
   ```
   - *Issue*: Assumes any string with `pubkey.length > 10` without a profile is a 56-char Stellar public key, truncating 11-15 character guest usernames (e.g., `'SpeedyGuest'` becomes `'Spee...uest'`).

---

## 2. Logic Chain

1. **Test Failure 5.1 Analysis**:
   - Requirement R3 requires non-downgrade score logic.
   - Test 5.1 sends scores `[100, 500, 200, 1500, 300, 1200, 800]` concurrently via `Promise.all`.
   - Because `api/score.ts` checks `currentScore` via `zscore` before calling `zadd`, all 7 requests execute `zscore` concurrently and receive `null` or `0`.
   - The request with score `800` executes its `zadd` call last, overwriting `1500` in Redis.
   - *Conclusion*: Non-atomic check-then-set causes high score corruption under concurrent requests.

2. **Test Failure 4.1 Analysis**:
   - Guest score `1800` is submitted with `name: 'SpeedyGuest'`.
   - When querying `GET /api/leaderboard`, `resolvePubkeyFromRedis` scans `slashslice:leaderboard_v2` for a record with score `1800`.
   - It finds a previously stored record for a registered user who also scored `1800` and returns that registered user's Stellar pubkey.
   - Consequently, the leaderboard entry's `pubkey` is set to the registered user's key rather than `'SpeedyGuest'`.
   - *Conclusion*: `resolvePubkeyFromRedis` falsely maps guest scores to registered user pubkeys due to loose score-only matching.

3. **Code Compliance & Quality Assessment**:
   - `api/user.ts`: Verified. Username uniqueness index and high score backfilling via `Math.max()` are correctly implemented.
   - `src/components/StellarHub.tsx`: Verified. Web3 wallet connect, automatic profile retrieval, and registration/editing modal integration function correctly.

---

## 3. Caveats

- `pnpm build` completes without errors; typescript types and module bundling are intact.
- Handlers in `api/user.ts` and `src/components/StellarHub.tsx` passed all single-threaded unit and contract tests.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Critical Findings:
1. **[Critical] Concurrency Race Condition in `api/score.ts`**: `zscore` read-then-write allows lower scores to overwrite higher scores when submitted concurrently.
   - *Remediation*: Pass `GT` flag to Redis `zadd` (e.g. `client.zadd(alltimeKey, { score: numericScore, member: identityKey }, 'GT')`) or implement atomic update logic.
2. **[Critical] False Pubkey Attribution in `api/leaderboard.ts`**: `resolvePubkeyFromRedis` matches records in `slashslice:leaderboard_v2` by score only, falsely assigning guest scores to registered users' public keys.
   - *Remediation*: Ensure `resolvePubkeyFromRedis` verifies that `rec.pubkey === rawPubkey` or `rec.name === rawPubkey` before returning `rec.pubkey`.
3. **[Minor] Guest Username Truncation in `api/leaderboard.ts`**: Truncation should only apply if `STELLAR_PUBKEY_REGEX.test(pubkey)` is true.

---

## 5. Verification Method

To independently verify the failure and remediation:

1. **Execute Full Test Suite**:
   ```bash
   pnpm test
   ```
   Observe the 2 failing tests in `tests/e2e/m3_gen2_empirical_stress.test.ts`.

2. **Inspect Logs & Test Assertion Error**:
   Notice `800 !== 1500` in Test 5.1 and missing `'SpeedyGuest'` entry in Test 4.1.
