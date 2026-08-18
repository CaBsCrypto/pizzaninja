# Dispatch for Worker M3-1

## Scope & Objective
Milestone 3: Score Sync & UI Integration (`api/score.ts`, `api/user.ts`, and `src/components/StellarHub.tsx`).

## Task Instructions
1. Review explorer findings from:
   - `.agents/explorer_m3_1_gen2/handoff.md`
   - `.agents/explorer_m3_2_gen2/handoff.md`
   - `.agents/explorer_m3_3_gen2/handoff.md`
2. Update `api/user.ts` to ensure `POST /api/user` preserves `arcadeScore` and `classicScore` from existing profile and backfills from ZSET keys `slashslice:leaderboard:arcade:alltime` / `slashslice:leaderboard:classic:alltime` if present.
3. Verify `api/score.ts` multi-period Redis ZSET sync (`alltime`, `weekly:<YYYY-Www>`, `daily:<YYYY-MM-DD>`), high score non-downgrade logic, and user profile sync.
4. Verify `src/components/StellarHub.tsx` Web3 wallet login flow, `GET /api/user` profile check, and `POST /api/user` registration modal trigger.
5. Run build (`pnpm build`) and test suite (`pnpm test` and `npx tsx --test tests/empirical_m3_stress.test.ts`).
6. Report findings and results in `handoff.md` inside your working directory.

## Write Ownership
- `api/score.ts`
- `api/user.ts`
- `src/components/StellarHub.tsx`

## 2026-08-11T04:52:38Z
Prompt message received for worker_m3_1_gen2 execution:
Milestone 3 Tasks:
1. Update `api/user.ts` to ensure `POST /api/user` preserves `arcadeScore` and `classicScore` from existing profile in `slashslice:user:<pubkey>` and backfills high scores from ZSET keys `slashslice:leaderboard:arcade:alltime` / `slashslice:leaderboard:classic:alltime` if present.
2. Verify `api/score.ts` multi-period Redis ZSET sync (`alltime`, `weekly:<YYYY-Www>`, `daily:<YYYY-MM-DD>`), high score non-downgrade logic, and user profile sync.
3. Verify `src/components/StellarHub.tsx` Web3 wallet login flow, `GET /api/user` profile check, and `POST /api/user` registration modal trigger.
4. Run build (`pnpm build`) and tests (`pnpm test` and `npx tsx --test tests/empirical_m3_stress.test.ts`).
5. Document all changes, test commands, build outputs, and verification in `handoff.md` in your working directory. Send a message to parent when complete.

