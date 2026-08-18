# Project: Slash Slice Arena Critical Bug Fixes & Verification

## Architecture & System Overview
Slash Slice Arena is a high-performance WebGL/Canvas game featuring ninja fruit/pizza slicing mechanics, MediaPipe computer vision hand tracking, Web3/Stellar on-chain leaderboard integration, and responsive arcade UI.

### Module Boundaries & Ownership
1. **HTML & Global CSS Core** (`index.html`, `src/index.css`):
   - Viewport meta definitions (`viewport-fit=cover`), touch prevention, safe area insets, fullscreen styles.
2. **Main Application Shell & Modal Management** (`src/App.tsx`):
   - Main wrapper flex layout, responsive header minimization during gameplay, drawer management, score modal data flow.
3. **Game Canvas, Loop & In-Game UI** (`src/components/PizzaCanvas.tsx`):
   - Game canvas rendering, responsive container sizing, in-game HUD layout, in-canvas modal overlays (Armería, Tutorial, Settings, Score Registration/Game Over), fullscreen element scoping, pointer/touch slice event handling.
4. **Computer Vision & Camera Lifecycle** (`src/components/HandTracker.tsx`, `src/components/PizzaCanvas.tsx`):
   - MediaPipe Hands lifecycle, camera media stream management, hardware track stopping, `isPausedRef` & `isHandLost` state synchronization, seamless fallback/switching to Normal Mode.
5. **E2E & Automated Test Suite** (`tests/e2e/*.test.ts`):
   - Automated tests across Tiers 1-5 verifying mobile scaling constraints, camera teardown/reset, fullscreen game over visibility, score persistence, and regression safety.

## Feature Inventory
| # | Feature / Bug | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Mobile Viewport Meta & Root Resets | Add `viewport-fit=cover`, touch-action none, safe area CSS | M1 | Survey R1 |
| 2 | Flexbox Main Container Scaling | Fix `App.tsx:680` missing `w-full` and shrink-wrap collapse | M1 | Survey R1 |
| 3 | Responsive Canvas Container | Replace rigid `aspect-[16/9]` + `max-h-[82vh]` with flexible letterboxed/aspect-aware scaling | M1 | Survey R1 |
| 4 | Main Menu & Play Buttons Sizing | Ensure Start/Play buttons, logo, and mascot fit without clipping in small screens | M1 | Survey R1 |
| 5 | Remove Portrait Hard Blocker | Allow full portrait mobile gameplay and menu access | M1 | Survey R1 |
| 6 | Responsive In-Game HUD | Compact HUD cards on screens < 520px to prevent wrapping & overlap | M1 | Survey R1 |
| 7 | Floating Wallet Tab Responsiveness | Prevent floating tab from intercepting touch slices on mobile | M1 | Survey R1 |
| 8 | Touch Stroke Boundary Retention | Prevent `pointerleave` from cancelling active slice strokes prematurely | M1 | Survey R1 |
| 9 | MediaPipe & Camera Stream Teardown | Ensure all camera tracks are stopped (`stream.getTracks().forEach(t => t.stop())`) on exit/game over/mode change | M2 | Survey R2 |
| 10 | Camera to Normal Mode `isPaused` Reset | Guarantee `isPausedRef.current = false` and `isHandLost = false` when switching to Normal Mode | M2 | Survey R2 |
| 11 | HandTracker Animation & Callback Cancellation | Fix `cancelVideoFrameCallback` / `cancelAnimationFrame` and `video.pause()` in teardown | M2 | Survey R2 |
| 12 | Camera Mode Reset on Game Over | Reset `controlMode` or deactivate `HandTracker` when game finishes or returns to menu | M2 | Survey R2 |
| 13 | Fullscreen Game Over Modal Encapsulation | Mount/render Game Over & Score Registration UI inside `containerRef` so it renders in Fullscreen Top Layer | M3 | Survey R3 |
| 14 | Seamless Game Over Transition | Ensure immediate zero-delay rendering of score, input, submit, retry, and menu buttons | M3 | Survey R3 |
| 15 | Direct "Play Again" Action | Add immediate retry capability from Game Over screen in both modes | M3 | Survey R3 |
| 16 | E2E Automated Test Suite (Tiers 1-4) | Comprehensive tests covering mobile layout, camera lifecycle, and fullscreen game over | E2E Track | Survey R3 |
| 17 | Adversarial Hardening (Tier 5) | White-box stress tests, edge case verification, build & lint verification | M4 | Survey R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Responsive Canvas & Mobile Scaling | `index.html`, `src/index.css`, `src/App.tsx`, `src/components/PizzaCanvas.tsx` (R1 items 1-8) | none | **DONE** |
| M2 | MediaPipe & Camera Lifecycle Cleanup | `src/components/HandTracker.tsx`, `src/components/PizzaCanvas.tsx` (R2 items 9-12) | M1 | **DONE** |
| M3 | Fullscreen Game Over Rendering & Transition | `src/components/PizzaCanvas.tsx`, `src/App.tsx` (R3 items 13-15) | M1, M2 | **DONE** |
| M4 | E2E Test Suite 100% Pass & Adversarial Hardening | Verification of full test suite, build & lint check, white-box adversarial tests | M1, M2, M3, E2E Track | **DONE** |



## Interface Contracts
### App.tsx ↔ PizzaCanvas.tsx
- `isRegistering: boolean` - indicates if game over / score registration dialog is open.
- `pendingScore: ScoreData | null` - score record metadata passed into `PizzaCanvas` for in-container rendering.
- `onRegisterScore: (chefName: string) => Promise<void>` - handler to commit score to storage/API.
- `onSkipScore: () => void` - handler to dismiss score registration and return to menu.
- `onRetryGame: () => void` - handler to immediately start a new game session.
- `controlMode: 'mouse' | 'camera'` - active input control method.
- `setControlMode: (mode: 'mouse' | 'camera') => void` - updates mode with guaranteed lifecycle cleanup.

### PizzaCanvas.tsx ↔ HandTracker.tsx
- `isEnabled: boolean` - when false, camera stream MUST immediately stop all tracks, cancel callbacks, and release webcam hardware.
- `onHandLost: (lost: boolean) => void` - only active when `controlMode === 'camera'`. Ignored in mouse/normal mode.

## Code Layout
- `index.html` - HTML shell
- `src/index.css` - Global CSS & safe area insets
- `src/App.tsx` - Root app shell & global state
- `src/components/PizzaCanvas.tsx` - Canvas game engine, in-game HUD, in-canvas modal manager
- `src/components/HandTracker.tsx` - MediaPipe camera vision tracker
- `src/components/Shop.tsx` - Cosmetic shop modal
- `src/components/StellarHub.tsx` - Stellar wallet & profile drawer
- `tests/e2e/` - E2E and unit test suites
