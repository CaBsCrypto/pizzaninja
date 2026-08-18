# Handoff Report — Explorer Survey R3

## 1. Observation
- **Fullscreen API Trigger**: In `src/components/PizzaCanvas.tsx` lines 147–177, `toggleFullscreen` executes `container.requestFullscreen()` on `containerRef.current` (which is attached to `<div ref={containerRef} ...>` on line 2857).
- **Game Over Trigger**: In `src/components/PizzaCanvas.tsx` lines 1020–1050, `isGameOver` is evaluated every 1000ms (or on obstacle collision in lines 2490–2503). On game over, `setIsPlaying(false)` is invoked and `onGameOver(...)` is called with score telemetry.
- **Score Registration DOM Location**: In `src/App.tsx` lines 733–745, `{pendingScore !== null && !isPlaying && <motion.div ...>{scoreRegistrationCard}</motion.div>}` is mounted inside `<main><div className="flex-1 ...">` as a sibling of `<PizzaCanvas />`, **outside** `PizzaCanvas`'s `containerRef` element.
- **Main Menu Hiding Condition**: In `src/components/PizzaCanvas.tsx` line 3094, the Main Menu overlay is guarded by `!isPlaying && !isRegistering && !(controlMode === 'camera' && handDetected)`. Because `isRegistering={pendingScore !== null}` is `true`, the Main Menu is suppressed.
- **Resulting Fullscreen DOM State**: The browser's Fullscreen Top Layer only renders `<div ref={containerRef}>`. Inside it, `isPlaying` is `false` (HUD is hidden), `isRegistering` is `true` (Main Menu is hidden), and `scoreRegistrationCard` is absent (rendered in `App.tsx` outside `containerRef`). The canvas is empty/black (`bg-slate-950`), freezing user interaction until manually pressing Escape.
- **Build & Lint Config**:
  - `package.json`: `"lint": "tsc --noEmit"`, `"build": "npx tsx copy-mediapipe-assets.js && vite build"`, `"test": "tsx --test tests/e2e/*.test.ts"`.
  - `tsconfig.json`: Target `ES2022`, module resolution `bundler`, paths alias `@/*`.
  - `vite.config.ts`: React, Tailwind v4, basic SSL, node polyfills.
- **Test Infrastructure**:
  - Test runner: Node.js native test runner (`node:test`, `node:assert/strict`) with `tsx`.
  - Test harness: `tests/helpers/mockKvServer.ts` (in-memory Upstash/Vercel KV REST API mock) and `tests/helpers/testServer.ts` (Express test harness).

## 2. Logic Chain
1. *Observation*: `toggleFullscreen()` makes `containerRef.current` (inside `PizzaCanvas.tsx`) the browser's active fullscreen element (`document.fullscreenElement`).
2. *Observation*: In W3C Fullscreen API standards, when a specific DOM element enters fullscreen, only that element and its subtree are promoted to the browser Top Layer. Sibling and parent elements are not rendered in fullscreen.
3. *Observation*: On game over, `App.tsx` sets `pendingScore` and renders `scoreRegistrationCard` outside `PizzaCanvas`.
4. *Observation*: `PizzaCanvas` receives `isRegistering = true` and unmounts the Main Menu overlay.
5. *Deduction*: When ending a game in fullscreen, the user only sees the contents of `containerRef.current`, which contains only the unrendered game canvas and no modals. The Game Over screen and buttons are completely inaccessible.
6. *Recommendation*: Moving the Game Over / Score Record modal rendering inside `<div ref={containerRef}>` (or passing it as children/prop to `PizzaCanvas`), or cleanly exiting fullscreen on game over, guarantees immediate visibility and full interactivity in fullscreen mode.

## 3. Caveats
- Investigated in read-only mode without modifying production application code.
- Tested against the full local codebase, configuration files, and test files.
- `HandTracker.tsx` camera cleanup (R2) and responsive viewport scaling (R1) are complementary requirements investigated by peer agents.

## 4. Conclusion
The root cause of Requirement R3 (fullscreen black screen on game over) is an architectural DOM boundary mismatch: the fullscreen element is `<div ref={containerRef}>` inside `PizzaCanvas`, while the Game Over / Score Registration overlay is rendered outside in `App.tsx`. Rendering the Game Over overlay inside `containerRef` will permanently resolve the issue with zero regressions.

## 5. Verification Method
1. Inspect `src/components/PizzaCanvas.tsx` lines 147–177 and 2856–2862 to verify `containerRef` placement.
2. Inspect `src/App.tsx` lines 733–756 to verify `scoreRegistrationCard` mounting location outside `PizzaCanvas`.
3. Check `survey_r3.md` at `.agents/explorer_survey_r3/survey_r3.md` for the full technical report.
4. Run project test suite via `npx tsx --test tests/e2e/*.test.ts` to verify API and E2E integrity.
