# Handoff Report — Leaderboard & Filtered Redis Schema (Survey Explorer 3)

**Author:** Survey Explorer 3  
**Target Recipient:** Orchestrator (`6ed7fc6a-854a-4728-8a10-ac1e2c62b588`)  
**Date:** 2026-08-11  
**Working Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_3`

---

## 1. Observation

1. **`ORIGINAL_REQUEST.md` (lines 15-17, 26-27)**:
   > "Implement `GET /api/leaderboard` and `GET /api/leaderboard/rank`. Allow filtering by mode (`arcade` | `classic`), timeframe (`alltime` | `weekly` | `daily`), and pagination (`limit`, `page`). Return ranked player arrays with metadata and calculate exact player rank and percentiles."
   > "OpenAPI documentation (`docs/API_REFERENCE.md`) is updated with `/api/user` and `/api/leaderboard`."

2. **`api/score.ts` (lines 22, 50-71)**:
   > `const rawScores = await client.zrange('slashslice:leaderboard_v2', 0, 19, { rev: true });`
   > Currently uses a single ZSET key `slashslice:leaderboard_v2` with stringified JSON objects as members. Performs $O(N)$ string scanning during updates:
   > `const allGlobalScores = await client.zrange('slashslice:leaderboard_v2', 0, -1);`
   > Does not support modes, timeframes, user profile lookup, or rank/percentile calculations.

3. **`docs/API_REFERENCE.md` (lines 40-211)**:
   Documents `GET /api/score`, `POST /api/score`, `POST /api/mint`, `POST /api/mint_nft`. Does NOT document `POST /api/user`, `GET /api/user`, `GET /api/leaderboard`, or `GET /api/leaderboard/rank`.

4. **`src/types.ts` (lines 108-122)**:
   Defines `ScoreRecord` with `name`, `score`, `timestamp`, `duration`, `slashes`, `pubkey`, `domain`, `txHash`, `mode`, `signedXdr`.

5. **`src/components/Leaderboard.tsx` (lines 369-376, 407-429)**:
   Currently filters scores in frontend client using `record.mode || 'arcade'` and switches between `arcade` and `classic` tabs.

---

## 2. Logic Chain

1. **Observation 1 & 2** show that the existing `/api/score` implementation uses a legacy Redis key `slashslice:leaderboard_v2` containing raw JSON string members. This structure makes filtered queries for `weekly`/`daily` timeframes impossible without fetching all records into memory.
2. **Therefore**, we must transition to dedicated Redis ZSET keys where members are Stellar public keys (`<pubkey>`) and scores are floats/integers:
   - `slashslice:leaderboard:<mode>:alltime`
   - `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>`
   - `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>`
3. **Observation 1 & 4** show that leaderboard queries need user metadata (username, avatar, etc.). By storing user profiles in `slashslice:user:<pubkey>` and username mappings in `slashslice:username:<username>`, the leaderboard endpoint can cleanly fetch ZSET members (`pubkey`) and hydrate them with profile metadata in $O(1)$ batch lookups.
4. **Observation 1 & 5** demonstrate that calculating exact rank requires `ZREVRANK key pubkey + 1`, total players requires `ZCARD key`, and percentile formulas require $P = \left(\frac{\text{total} - \text{rank} + 1}{\text{total}}\right) \times 100$ and $T = \left(\frac{\text{rank}}{\text{total}}\right) \times 100$.
5. **Observation 3** confirms `docs/API_REFERENCE.md` is incomplete and requires documentation of `/api/user`, `/api/leaderboard`, and `/api/leaderboard/rank`.

---

## 3. Caveats

- **Timeframe Period Formats**: Period-based keys (`slashslice:leaderboard:<mode>:weekly:2026-W32` and `slashslice:leaderboard:<mode>:daily:2026-08-11`) are recommended over static keys (`slashslice:leaderboard:<mode>:weekly`) because they prevent historical data corruption without needing manual TTL wipes. However, static keys can also be used if auto-expiring TTLs are set.
- **Legacy Compatibility**: `api/score.ts` should continue syncing to `slashslice:leaderboard_v2` during the transition to avoid breaking any legacy UI components until Milestone 3 is complete.

---

## 4. Conclusion

- The implementation specs for `GET /api/leaderboard` and `GET /api/leaderboard/rank` are fully defined and ready for development in Milestone 2.
- The Redis key layout (`slashslice:leaderboard:<mode>:<timeframe>`, `slashslice:user:<pubkey>`, `slashslice:username:<username>`) will support fast, scalable pagination, rank queries, and atomic score updates.
- Exact rank and percentile math is fully documented with edge case handling.
- `docs/API_REFERENCE.md` requires updates for `/api/user`, `/api/leaderboard`, and `/api/leaderboard/rank`.

---

## 5. Verification Method

1. **Inspect Analysis Report**:
   Read `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_3\analysis.md`.
2. **Inspect Existing Files**:
   Verify line numbers and code snippets in `api/score.ts`, `docs/API_REFERENCE.md`, and `src/components/Leaderboard.tsx`.
3. **Project Build Check**:
   Run `pnpm build` in root workspace directory to verify existing code compiles cleanly without errors.
