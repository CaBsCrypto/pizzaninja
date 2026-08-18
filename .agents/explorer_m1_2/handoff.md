# Handoff Report: Milestone 1 — User Registration & Profile API (`/api/user`)

## 1. Observation
- **Project Configuration**:
  - `ORIGINAL_REQUEST.md` (lines 12-14): Specifies `POST /api/user` and `GET /api/user` backed by Vercel KV. `POST` registers Stellar pubkey (`G...`), unique username (3-15 chars, alphanumeric + `_`), avatar, and Privy DID. `GET` retrieves profile, high scores, and global rank.
  - `PROJECT.md` (lines 11-17, 41-53): Defines key schema (`slashslice:user:<pubkey>` Hash, `slashslice:username:<normalized_username>` String index, `slashslice:privy:<privyDid>` String reverse lookup), `POST /api/user` contracts, and `GET /api/user` contracts.
  - `@vercel/kv` version `^3.0.0` is present in `package.json` (line 28).
- **Existing API Handlers**:
  - `api/score.ts` (lines 1-17, 50-73): Demonstrates `@vercel/kv` usage with `client = kv as any;` and ZSET operations (`zscore`, `zadd`, `zrange`).
  - `api/wallet.ts` (lines 1-24): Demonstrates `client.hgetall` usage for retrieving user data hashes.
- **Frontend Integration**:
  - `src/components/StellarHub.tsx` (lines 44-75, 298-308): Interacts with Privy login, derives deterministic Stellar G-address keypair, and displays connected state.

---

## 2. Logic Chain
1. **Observation**: `PROJECT.md` defines `slashslice:username:<normalized_username>` as a String key mapping to `<pubkey>`.
   **Reasoning**: Case-insensitive uniqueness enforcement requires converting usernames to lower-case for key generation (e.g. `slashslice:username:pizzaninja`), while preserving original casing in the `slashslice:user:<pubkey>` hash (e.g. `username: "PizzaNinja"`).
2. **Observation**: A GET-then-SET pattern (`await kv.get(...)` followed by `await kv.set(...)`) is vulnerable to race conditions under concurrent requests for the same username.
   **Reasoning**: To ensure atomic reservation without race conditions, `POST /api/user` must verify existing ownership first. If the key is unowned, it must call `client.set(key, pubkey, { nx: true })` (SETNX). If `set` returns `null`, the username was claimed concurrently and must return HTTP 409 Conflict.
3. **Observation**: Users updating an existing profile with the same username would trigger a conflict if only SETNX were used without checking ownership.
   **Reasoning**: Checking whether `existingOwner === pubkey` before attempting SETNX ensures that re-registrations or avatar updates by the same pubkey succeed cleanly.
4. **Observation**: `GET /api/user` accepts `pubkey` or `username` query parameters and requires profile stats (`arcadeScore`, `classicScore`, `globalRank`).
   **Reasoning**: If `username` is provided, the endpoint resolves the pubkey via `slashslice:username:<normalized>`. It then fetches `slashslice:user:<pubkey>` via `hgetall`. For stats, it queries `zscore` on `slashslice:leaderboard:arcade:alltime` and `slashslice:leaderboard:classic:alltime` (with fallback to `slashslice:scores:<pubkey>`), and computes `globalRank` via `zrevrank('slashslice:leaderboard:arcade:alltime', pubkey) + 1` (or `null` if unranked).

---

## 3. Caveats
- **Score Key Transition**: `api/score.ts` currently uses legacy keys (`slashslice:scores:<pubkey>` and `slashslice:leaderboard_v2`). Milestone 3 will align `api/score.ts` with `slashslice:leaderboard:<mode>:alltime`. In `GET /api/user`, querying `slashslice:leaderboard:arcade:alltime` with fallback to `slashslice:scores:<pubkey>` ensures compatibility during the transition.
- **Unranked Users**: Users who haven't submitted any game scores will return `arcadeScore: 0`, `classicScore: 0`, and `globalRank: null`.

---

## 4. Conclusion
The detailed edge-case analysis for Milestone 1 is complete and fully documented in `analysis.md`. The design provides robust, atomic username uniqueness check using `@vercel/kv` `SETNX`, reverse lookups for Privy DIDs, parameter resolution and 404/400 handling in `GET /api/user`, and score/rank extraction. Implementers can immediately use `analysis.md` as the blueprint for creating `api/user.ts`.

---

## 5. Verification Method
- **File Inspection**:
  - `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_m1_2\analysis.md`
  - `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_m1_2\handoff.md`
- **Build Verification**:
  - Run `pnpm build` or `npx tsc --noEmit` in project root to verify TypeScript compilation once `api/user.ts` is implemented.
