# Dispatch for Challenger M3-1

## Mission
Perform empirical verification and stress testing of Milestone 3 (`api/score.ts`, `api/user.ts`, `src/components/StellarHub.tsx`).
Verify:
1. Multi-period score sync across `alltime`, `weekly`, `daily` ZSETs.
2. High score non-downgrade logic and profile score backfilling upon registration.
3. Run `pnpm test` and `npx tsx --test tests/empirical_m3_stress.test.ts`.

Write your challenge report and verdict (APPROVE / REJECT) in `handoff.md` in your working directory.
