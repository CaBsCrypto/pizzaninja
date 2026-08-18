# Dispatch for Worker M3-2 (Remediation Iteration 2)

## Scope & Objective
Remediate concurrency race condition in `api/score.ts` and identity resolution defect / guest username truncation in `api/leaderboard.ts`.

## Review Feedback to Resolve
From `.agents/reviewer_m3_1_gen2/handoff.md`:
1. **Concurrency Race Condition in `api/score.ts`**:
   - Issue: Non-atomic `zscore` then `zadd` allows lower concurrent score submissions (e.g., 800) to overwrite higher concurrent score submissions (e.g., 1500).
   - Remediation: Pass `'GT'` option to `client.zadd` (e.g. `await client.zadd(alltimeKey, { score: numericScore, member: identityKey }, 'GT')` or `client.zadd(alltimeKey, { nx: false, ch: false, incr: false, gt: true }, ...)` depending on `@vercel/kv` client signature, OR use atomic transaction/lua script or re-fetch `zscore` inside lock/atomic check). Note: check how `@vercel/kv` supports options or compare `zscore` after `zadd` to ensure the ZSET keeps the maximum score.
2. **False Pubkey Attribution in `api/leaderboard.ts`**:
   - Issue: `resolvePubkeyFromRedis` scans `slashslice:leaderboard_v2` and matches records by score alone, causing guest scores to be assigned to arbitrary registered users' Stellar public keys.
   - Remediation: Update `resolvePubkeyFromRedis` to verify `rec.pubkey === rawPubkey` or `rec.name === rawPubkey` before returning `rec.pubkey`.
3. **Guest Username Truncation in `api/leaderboard.ts`**:
   - Issue: Strings > 10 chars without a profile are assumed to be Stellar public keys and truncated (`xxxx...xxxx`), truncating 11-15 char guest usernames (e.g., `SpeedyGuest`).
   - Remediation: Only apply pubkey truncation if `STELLAR_PUBKEY_REGEX.test(cleanPubkey(pubkey))` is true.

## Write Ownership
- `api/score.ts`
- `api/leaderboard.ts`
- `api/user.ts`
- `src/components/StellarHub.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
