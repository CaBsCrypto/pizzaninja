# Orchestration Plan: Slash Slice Arena Bug Fixes & Verification

## Objective
Fix, polish, and verify the 3 critical bugs in *Slash Slice Arena*:
1. R1: Responsive Canvas & Mobile Viewport Scaling
2. R2: MediaPipe & Webcam Lifecycle Shutdown and Cleanup
3. R3: Fullscreen Game Over Screen Rendering & Immediate Transition
4. Comprehensive Automated Tests, Build and Lint Validation

## Architecture & Tracks

### Survey Phase (Phase 0)
- Explorer 1 (`.agents/explorer_survey_r1`): Responsive canvas & mobile viewport scaling inspection.
- Explorer 2 (`.agents/explorer_survey_r2`): MediaPipe & Webcam lifecycle shutdown and cleanup inspection.
- Explorer 3 (`.agents/explorer_survey_r3`): Fullscreen Game Over UI, testing infrastructure, build and lint inspection.

### Global Plan & Project Definition (Phase 1)
- Synthesize survey findings into `PROJECT.md` and `TEST_INFRA.md`.
- Establish precise milestones and interface contracts.

### Dual Track Execution (Phase 2)
- **E2E Testing Track**:
  - Test suite covering Tiers 1-4 (Mobile Layout/Scaling, Camera State Cleanup & Lifecycle, Fullscreen Game Over Flow, Regression/Integration).
  - Publishes `TEST_READY.md`.
- **Implementation Track**:
  - **Milestone 1: Responsive Canvas & Mobile Viewport Scaling (R1)**
    - Explorer -> Worker -> Reviewer(x2) -> Challenger(x2) -> Forensic Auditor -> Gate.
  - **Milestone 2: MediaPipe & Webcam Lifecycle Cleanup (R2)**
    - Explorer -> Worker -> Reviewer(x2) -> Challenger(x2) -> Forensic Auditor -> Gate.
  - **Milestone 3: Fullscreen Game Over UI Rendering & Transition (R3)**
    - Explorer -> Worker -> Reviewer(x2) -> Challenger(x2) -> Forensic Auditor -> Gate.
  - **Milestone 4: E2E Test Suite Pass & Adversarial Hardening (Phase 1 & 2)**
    - Verify 100% E2E test suite pass, lint/build clean pass, and adversarial edge case coverage.

## Verification & Acceptance Criteria
- `npm run build` passes with zero errors.
- `npm run lint` passes with zero errors.
- Mobile viewports (375x667, 390x844, 412x915) display canvas properly scaled without collapsing; buttons centered & touchable.
- Exiting camera mode completely stops media streams, resets pause state, removes camera artifacts/alerts.
- Fullscreen game over renders immediate, interactive UI without black screen overlays.
- All unit, integration, and E2E tests pass 100%.
- Forensic audit CLEAN with ZERO integrity violations.
