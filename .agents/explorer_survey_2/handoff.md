# Handoff Report: Survey Explorer 2 — User Registration, Profile Management & UI Integration

## 1. Observation
Direct codebase observations:

- **Missing User Endpoints**:
  - `api/user.ts` does not exist in the filesystem.
  - Currently existing API routes in `api/`: `mint.ts`, `mint_nft.ts`, `score.ts`, `wallet.ts`.
- **Existing Key Specifications & Patterns**:
  - `api/mint.ts:7`: Stellar public key regex `const STELLAR_PUBKEY_RE = /^G[A-Z2-7]{55}$/;` (56 characters total, Base32).
  - `api/score.ts:50`: Writes to `slashslice:scores:${identityKey}` and `slashslice:leaderboard_v2`.
  - `api/wallet.ts:22`: Reads `slashslice:wallet:${wallet}` using `client.hgetall(...)`.
- **Privy Identity Derivation**:
  - `src/components/StellarHub.tsx:46-54`: SHA-256 hash of `user.id + "_spicycrust_privy_shared_salt_2026"` converted to 32 bytes seed -> `Keypair.fromRawEd25519Seed(Buffer.from(hashArray))` generating a native `G...` Stellar pubkey.
  - `src/services/stellarWallet.ts:28-30`: Sets global variable `web3AuthKeypair` for signing Soroban transactions.
- **UI / App Score Registration Flow**:
  - `src/App.tsx:267-308`: Score submission calls `/api/mint` and `/api/mint_nft`.
  - `src/App.tsx:476-558`: `scoreRegistrationCard` builds and signs Soroban `submit_score` transaction and submits record to `/api/score`.
  - `src/components/StellarHub.tsx:15-26`: Manages `StellarWalletState` (`connected`, `publicKey`, `walletType`) and handles cookie-based SSO (`stellar_wallet`).

---

## 2. Logic Chain
1. **Observation**: `api/user.ts` does not exist, and current score records store raw unvalidated display names or pubkeys in legacy keys (`slashslice:leaderboard_v2`).
   -> **Reasoning**: A formal user profile management system is required (`POST /api/user` and `GET /api/user`) backed by Vercel KV.
2. **Observation**: Username uniqueness must be enforced across all registrations.
   -> **Reasoning**: Storing a secondary index key in Redis (`slashslice:username:<normalized_username>`) mapping to `<pubkey>` provides an atomic lookup mechanism to prevent duplicate username registration before saving to `slashslice:user:<pubkey>`.
3. **Observation**: Stellar public key validation regex exists in `api/mint.ts` (`/^G[A-Z2-7]{55}$/`), and username requirements specify 3-15 chars, alphanumeric + `_`.
   -> **Reasoning**: Enforcing `STELLAR_PUBKEY_RE.test(pubkey)` and `/^[a-zA-Z0-9_]{3,15}$/.test(username)` in `POST /api/user` satisfies validation security requirements.
4. **Observation**: `StellarHub.tsx` already derives deterministic Stellar keys from Privy DIDs (`user.id`) upon Web2 login.
   -> **Reasoning**: `StellarHub.tsx` can query `GET /api/user?pubkey=<pubkey>` upon wallet connection. If no profile exists, it can open a profile setup modal for the user to pick their username and avatar, then call `POST /api/user`.
5. **Observation**: `api/score.ts` currently writes to legacy leaderboard keys.
   -> **Reasoning**: Updating `api/score.ts` to sync with `slashslice:leaderboard:<mode>:alltime` (and multi-period keys) and update personal bests in `slashslice:user:<pubkey>` unifies leaderboard and profile data.

---

## 3. Caveats
- **Passkey Demo Key Format**: In `StellarHub.tsx:165`, the passkey demo mode generates a simulated key starting with `G` followed by 48 hex characters (length 49 total), which does NOT pass standard 56-char Stellar Ed25519 regex validation (`/^G[A-Z2-7]{55}$/`). Demo passkeys should either be formatted to match standard 56-char Base32 format or handled as mock accounts.
- **Client-side Storage Coexistence**: `App.tsx` contains fallback code reading from `localStorage.getItem('slash_slice_scores_v2')`. When Vercel KV is available, server responses take precedence.

---

## 4. Conclusion
1. **User API**: Implement `POST /api/user` and `GET /api/user` in `api/user.ts`. Use Redis keys `slashslice:user:<pubkey>` for profiles and `slashslice:username:<lowercase_username>` for uniqueness indexing. Enforce Stellar key validation (`/^G[A-Z2-7]{55}$/`) and username constraints (`/^[a-zA-Z0-9_]{3,15}$/`).
2. **Wallet & Privy Integration**: Leverage existing Privy deterministic seed derivation in `StellarHub.tsx` (`user.id` -> SHA-256 seed -> Stellar `Keypair`). Use Privy DID (`did:privy:...`) as optional mapping index `slashslice:privy:<privyDid>`.
3. **UI & Score Sync**: Integrate profile fetching/creation into `StellarHub.tsx`. Update `api/score.ts` to write to `slashslice:leaderboard:<mode>:alltime` and sync user high scores in `slashslice:user:<pubkey>`.

---

## 5. Verification Method
1. **Compilation Check**:
   Run `pnpm build` or `npx tsc --noEmit` from the root directory to verify no TypeScript compilation errors.
2. **File Verification**:
   - Check presence of `analysis.md` and `handoff.md` in `.agents/explorer_survey_2/`.
   - Inspect `api/score.ts`, `src/components/StellarHub.tsx`, and `src/services/stellarWallet.ts` for consistency.
3. **Invalidation Conditions**:
   - If `@vercel/kv` connection is missing in local environment, Vercel KV fallback/mock behavior must be used during dev testing.
