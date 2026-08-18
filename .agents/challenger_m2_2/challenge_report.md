# Challenge Report — Milestone 2 (MediaPipe & Webcam Lifecycle Cleanup - Requirement R2)

## Challenge Summary

**Overall risk assessment**: LOW  
**Verdict**: APPROVE

---

## Challenges

### [Low] Challenge 1: In-Flight `getUserMedia` Resolution Race Condition
- **Assumption challenged**: Does an asynchronous camera permission request or delayed `getUserMedia` resolution leave an orphaned active webcam stream if the user cancels or switches modes during the browser permission prompt?
- **Attack scenario**: User selects Camera Mode, browser displays permission dialog, user switches back to Mouse Mode ("JUGAR NORMAL") before granting permission. When `getUserMedia` resolves, could the camera stream persist in the background?
- **Blast radius**: Webcam hardware remains locked in background, green camera indicator remains lit, decoder resources held.
- **Mitigation verified**: `HandTracker.tsx` lines 423-432 explicitly check `if (!videoRef.current || !isEnabledRef.current)` immediately after `getUserMedia` resolves and iterates `stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t); })`. Verified in `tests/e2e/challenger_m2_empirical_stress.test.ts`.

### [Low] Challenge 2: Pause State & Hand Lost Leakage into Mouse Mode
- **Assumption challenged**: If optical tracking triggers auto-pause after 2000ms ("DETECCIÓN PERDIDA"), could `isPausedRef.current` or `isPaused` state remain trapped at `true` when switching to Mouse Mode, halting the canvas game loop?
- **Attack scenario**: Hand tracking loses sight of hand, auto-pause engages, player clicks "VOLVER AL RATÓN" or "JUGAR NORMAL".
- **Blast radius**: Unplayable game freeze in mouse mode, or unwanted pause banner covering the canvas.
- **Mitigation verified**: Triple defense implemented:
  1. `useEffect([controlMode])` (`PizzaCanvas.tsx:632-655`) synchronously forces `isPausedRef.current = false`, `setIsPaused(false)`, `handDetectedRef.current = false`, `setHandDetected(false)`, and wipes optical velocities/targets.
  2. `updateLoop` (`PizzaCanvas.tsx:1335-1339`) contains defensive assertion: `else if (controlMode === 'mouse' && isPausedRef.current) { isPausedRef.current = false; setIsPaused(false); }`.
  3. Pause banner drawing (`PizzaCanvas.tsx:2266`) is strictly gated by `isPlaying && isPausedRef.current && controlMode === 'camera'`.
  4. Coordinate handler (`PizzaCanvas.tsx:2744`) starts with `if (controlMode !== 'camera') return;` ignoring all external hand lost/found coordinate dispatches in mouse mode.

### [Low] Challenge 3: MediaStream Hardware Track State on Teardown
- **Assumption challenged**: Do all active MediaStream tracks transition to W3C `readyState === 'ended'`, video elements unload from audio/video decoder pipelines, and MediaPipe WASM instances cleanly close on exit and Game Over?
- **Attack scenario**: Mode toggle, exit to menu, or match termination in Camera Mode.
- **Blast radius**: Memory leak, GPU shader memory retained, camera hardware remaining active.
- **Mitigation verified**: `handleStopTracking` (`HandTracker.tsx:537-598`):
  - Calls `track.stop()` and `stream.removeTrack(track)` for all tracks.
  - Calls `videoRef.current.pause()`, sets `srcObject = null`, removes `'src'` attribute, and calls `.load()`.
  - Cancels dual RAF / RVFC via `cancelVideoFrameCallback` or `cancelAnimationFrame`.
  - Calls `handsInstanceRef.current.close()`.
  - Game Over (`PizzaCanvas.tsx:1050-1060`) automatically resets `controlMode = 'mouse'`, triggering unmount teardown.

---

## Empirical Stress Test Results

| Scenario / Test Case | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **1. Track Teardown Status** | `track.readyState === 'ended'`, stream tracks removed | `readyState === 'ended'`, tracks = 0 | **PASS** |
| **2. In-flight getUserMedia Abort** | Stream stopped and discarded immediately | All tracks stopped on promise resolve | **PASS** |
| **3. Mouse Mode Isolation** | 10s gameplay with 0 hand input never pauses | 0 pauses, 0 overlay renders, 0 slashes | **PASS** |
| **4. Pause Mode Switch Recovery** | Camera pause -> Mouse switch immediately unpauses | `isPaused = false`, loop continues | **PASS** |
| **5. Game Over Camera Teardown** | Game over resets `isPaused = false`, `mode = 'mouse'` | Camera closed, pause reset | **PASS** |
| **6. Rapid Mode Cycling (20x)** | 20 successive toggles cleanly end all 20 tracks | 20/20 tracks ended, no memory leak | **PASS** |

---

## Unchallenged Areas

- Soroban on-chain smart contract gas limits (out of scope for M2 webcam lifecycle).
- WebGL canvas pixel ratio scaling on exotic foldable devices (covered under M1).
