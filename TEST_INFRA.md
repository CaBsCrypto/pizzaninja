# E2E Test Infra: Slash Slice Arena Bug Fixes & Architecture Hardening

## Test Philosophy
- Requirement-driven, opaque-box and state-driven automated tests verifying bug fixes for R1, R2, and R3.
- Native Node.js test runner (`node:test`, `node:assert/strict`) via `npm test` (`tsx --test tests/e2e/*.test.ts`).
- Verification across 4 distinct test tiers:
  - **Tier 1**: Feature Coverage (Happy path behavior, clean mode switching, responsive geometry, clean game over).
  - **Tier 2**: Boundary & Edge Cases (Extreme viewports: 375x667, 320x480, 915x412, rapid mode toggling, unexpected camera permissions rejection, immediate zero-score game overs).
  - **Tier 3**: Cross-Feature Interactions (Mode switch during countdown, Fullscreen game over in camera mode, mobile rotation during active game).
  - **Tier 4**: Real-World User Scenarios (Full game lifecycle from landing -> play normal -> game over in fullscreen -> retry -> play camera -> exit to menu -> verify no camera lock).

## Test Suites Layout
1. `tests/e2e/r1_responsive_viewport.test.ts`:
   - Validates viewport meta configuration.
   - Validates responsive CSS classes and element layout constraints.
   - Validates touch event retention and menu button accessibility.
2. `tests/e2e/r2_camera_lifecycle.test.ts`:
   - Validates MediaPipe / stream track teardown and memory release.
   - Validates that switching from camera to normal mode strictly resets `isPausedRef` and clears `DETECCIÓN PERDIDA`.
   - Validates game over camera deactivation.
3. `tests/e2e/r3_fullscreen_gameover.test.ts`:
   - Validates Game Over UI rendering inside the fullscreen container.
   - Validates score input, submit, skip, and retry transitions.
   - Validates z-index hierarchy and pointer-events interactivity.
4. `tests/e2e/user_api.test.ts` & `tests/e2e/leaderboard_api.test.ts`:
   - Existing backend API and score sync verification tests.

## Pass / Fail Criteria
- All tests must pass with exit code 0 (`npm test`).
- TypeScript compiler check (`npm run lint` / `tsc --noEmit`) passes with 0 errors.
- Build command (`npm run build`) produces clean production bundle with 0 errors.
