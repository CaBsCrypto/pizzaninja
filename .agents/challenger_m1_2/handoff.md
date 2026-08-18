# Handoff Report — Challenger 2 (Milestone 1)

## 1. Observation

- **Implementation File**: `api/user.ts`
- **Build Command**: `pnpm build`
  - Result: Exit code `0` (`built in 24.30s`). Compiled output placed in `dist/`.
- **Empirical Test Suite**: `.agents/challenger_m1_2/run_empirical_tests.ts`
  - Total tests executed: 29
  - Passed: 28
  - Failed: 1 (out-of-spec query parameter `privyDid` on `GET /api/user`)

### Summary of Empirical Observations by Category:

1. **Case Sensitivity Edge Cases**:
   - `POST /api/user` with username `"User_One"` sets `slashslice:username:user_one` in Vercel KV pointing to the user's public key (`GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4`).
   - Attempting to register `"user_one"`, `"USER_ONE"`, or `"uSeR_oNe"` from a different public key correctly returns HTTP status `409` (`{ success: false, error: "Username already taken" }`).
   - Updating username casing for the same owner (e.g., `"User_One"` -> `"USER_ONE"`) succeeds with HTTP `200`.
   - Changing username to `"New_Name"` correctly deletes the old normalized index `slashslice:username:user_one` and creates `slashslice:username:new_name`.
   - Re-registering the released username `"user_one"` by another user succeeds with HTTP `200`.

2. **Profile Lookup by Username vs Pubkey**:
   - `GET /api/user?pubkey=G...` returns HTTP `200` with profile metadata, high scores, and global rank.
   - `GET /api/user?username=New_Name`, `GET /api/user?username=new_name`, and `GET /api/user?username=NEW_NAME` all successfully retrieve the profile (case-insensitive lookup).
   - `GET /api/user?pubkey=G...&username=New_Name` prioritizes `pubkey` parameter.
   - Non-existent pubkeys or usernames return HTTP `404` (`{ success: false, error: "User not found" }`).
   - Malformed Stellar public keys (e.g., invalid base32 characters like `8` or length != 56) return HTTP `400` (`{ success: false, error: "Invalid Stellar public key format" }`).
   - Malformed usernames (e.g., length < 3 or non-alphanumeric chars) return HTTP `400`.

3. **Privy DID Lookup Integration**:
   - `POST /api/user` with `privyDid: "did:privy:clp2u2k2c000kmt08y8r7u03q"` populates `slashslice:privy:did:privy:clp2u2k2c000kmt08y8r7u03q` pointing to the public key in Vercel KV.
   - Updating `privyDid` deletes the previous `slashslice:privy:<oldPrivyDid>` key and sets the new key.
   - Profile updates that omit `privyDid` retain the user's existing `privyDid`.
   - `GET /api/user?privyDid=...` returns HTTP `400` because `PROJECT.md` specifies `GET /api/user` query parameter as `pubkey` OR `username`.

4. **Missing or Null Fields in Request Payload**:
   - Empty request payload `{}` returns HTTP `400`.
   - `pubkey: null` or `username: null` returns HTTP `400`.
   - `avatar: null` and `privyDid: null` default gracefully without crashing (`avatar` defaults to `'default'`).
   - Non-string types for `pubkey` or `username` return HTTP `400`.
   - `GET /api/user` without parameters or with empty parameters (`?pubkey=`) returns HTTP `400`.

## 2. Logic Chain

1. `PROJECT.md` defines the interface contract for `POST /api/user` (registration with case-insensitive username index, Privy DID reverse lookup, payload validation) and `GET /api/user` (profile retrieval by pubkey or username with scores/ranks).
2. Empirical testing verified that `api/user.ts` handles case sensitivity correctly in registration, index cleanup, and lookup.
3. Empirical testing verified that Stellar public key validation accurately enforces the Base32 ED25519 specification (`^G[A-Z2-7]{55}$`), rejecting invalid characters (such as `8` or `9`) with HTTP `400`.
4. Empirical testing verified that Privy DID reverse lookup keys (`slashslice:privy:<privyDid>`) are correctly set in Vercel KV upon registration and cleaned up upon updates.
5. Build verification confirmed that `pnpm build` completes with exit code `0` and generates production build artifacts without TypeScript compilation errors.

## 3. Caveats

- `GET /api/user` does not accept `privyDid` as a direct URL query parameter (returns `400 Missing pubkey or username parameter`). This matches the contract in `PROJECT.md` (`Query: pubkey OR username`), so it is not a defect, but external callers must query by `pubkey` or `username`.
- Testing was conducted using the local Vercel KV server emulator (`MockKvServer`) matching Upstash Redis REST API semantics.

## 4. Conclusion

**Verdict: APPROVE**

`api/user.ts` fulfills all requirements for Milestone 1:
- Username uniqueness and case sensitivity are strictly enforced.
- Profile lookups by `pubkey` and `username` operate correctly with scores and rank metadata attached.
- Privy DID reverse lookup indexing functions as intended.
- Request payload validation handles missing, null, and invalid inputs gracefully.
- `pnpm build` compiles cleanly.

## 5. Verification Method

To independently verify these results:

1. Run the empirical stress test harness:
   ```bash
   npx tsx .agents/challenger_m1_2/run_empirical_tests.ts
   ```
   *Expected output*: 28/29 tests pass (1 out-of-spec test fails as expected).

2. Run the project build:
   ```bash
   pnpm build
   ```
   *Expected output*: `✓ built in ...` with exit code `0`.
