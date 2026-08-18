# Handoff Report: Challenger M2 (Requirement R2)

**Milestone:** Milestone 2 (MediaPipe & Webcam Lifecycle Cleanup - Requirement R2)  
**Agent:** Challenger 1 (critic, specialist)  
**Date:** 2026-08-18  
**Verdict:** **APPROVE**

---

## 1. Observation

Direct empirical observations and code analysis:

- **Hardware Track Teardown**: In `src/components/HandTracker.tsx:555-569`, `handleStopTracking` extracts all tracks via `streamRef.current.getTracks()`, calls `track.stop()`, and removes them from the stream using `streamRef.current?.removeTrack(track)` before nulling `streamRef.current`.
- **Video Decoder Deallocation**: In `src/components/HandTracker.tsx:572-579`, `handleStopTracking` calls `videoRef.current.pause()`, clears `videoRef.current.srcObject = null`, invokes `videoRef.current.removeAttribute('src')`, and triggers `videoRef.current.load()`.
- **Loop Token Cancellation**: In `src/components/HandTracker.tsx:541-552`, both `cancelVideoFrameCallback` and `cancelAnimationFrame` are handled conditionally based on browser capability, and `frameIdRef.current` is set to `null`.
- **MediaPipe Instance Disposal**: In `src/components/HandTracker.tsx:582-588` and `331-334`, `handsInstanceRef.current.close()` is executed prior to re-instantiation and during teardown, releasing WebAssembly and WebGL context resources.
- **Async Cancellation & getUserMedia Guard**:
  - `src/components/HandTracker.tsx:214-266` manages an `isCancelled` flag inside `useEffect([isEnabled, sourceType])`.
  - `src/components/HandTracker.tsx:423-432` inspects `!videoRef.current || !isEnabledRef.current` immediately after `await navigator.mediaDevices.getUserMedia(...)` resolves to discard and stop any streams acquired if the user switched modes while the browser prompt was pending.
- **Control Mode State Synchronization**: In `src/components/PizzaCanvas.tsx:631-655`, switching `controlMode` to `'mouse'` forces `isPausedRef.current = false`, `setIsPaused(false)`, `handDetectedRef.current = false`, `setHandDetected(false)`, and clears target hand coordinates, velocity, and optical blade trails (`trail1`).
- **Defensive Game Loop Unpause**: In `src/components/PizzaCanvas.tsx:1335-1339`, `updateLoop` enforces:
  ```ts
  else if (controlMode === 'mouse' && isPausedRef.current) {
    isPausedRef.current = false;
    setIsPaused(false);
  }
  ```
- **"DETECCIÓN PERDIDA" Overlay Isolation**: In `src/components/PizzaCanvas.tsx:2266`, the pause overlay is strictly guarded by `isPlaying && isPausedRef.current && controlMode === 'camera'`.
- **Game Over Cleanup**: In `src/components/PizzaCanvas.tsx:1054-1060`, match termination (`isGameOver`) immediately resets `setControlMode('mouse')`, `isPausedRef.current = false`, `setIsPaused(false)`, and `handDetectedRef.current = false`.

---

## 2. Logic Chain

1. **Stream Cleanup Integrity**: By explicitly calling `.stop()` on every `MediaStreamTrack`, removing the track from the `MediaStream`, pausing the `<video>` element, stripping the `'src'` attribute, calling `.load()`, and cancelling pending `requestVideoFrameCallback` / `requestAnimationFrame` IDs, the application guarantees that hardware camera access and background decoding cease immediately when `controlMode` changes or the component unmounts.
2. **Race Condition Prevention**: The combination of `isCancelled` in the script loader `useEffect` and the post-`getUserMedia` check against `!isEnabledRef.current` ensures that asynchronous promises resolving after a mode toggle or component unmount do not leak active camera streams into the background or attempt to start inference on closed MediaPipe instances.
3. **UI State Isolation**: The dedicated `useEffect([controlMode])` coupled with the defensive check inside `updateLoop` guarantees that mouse mode can never inherit or retain a paused state triggered by optical tracking latency. The "DETECCIÓN PERDIDA" banner is strictly rendered only when `controlMode === 'camera'`.
4. **End-to-End Test Verification**:
   - `tests/e2e/r2_camera_lifecycle.test.ts`: 14 tests passing.
   - `tests/e2e/challenger_m2_stress.test.ts`: 14 tests passing.
   - Total 28 tests passing with 0 failures across 100-cycle toggle storms, error categorization, async cancellation, and game loop invariants.

---

## 3. Caveats

- **Physical Hardware Variations**: Automated tests verify the browser API contracts (`MediaStream`, `MediaStreamTrack`, `MediaPipe`, `requestVideoFrameCallback`, `HTMLVideoElement`). On unusual OS/hardware configurations with faulty camera drivers, driver-level crashes remain outside JS runtime control, but the JS error boundary and `NotAllowedError` / `NotReadableError` handling will catch and route them to mouse fallback.
- No caveats regarding Requirement R2 specifications.

---

## 4. Conclusion

Requirement R2 (MediaPipe & Webcam Lifecycle Cleanup) is **APPROVED**. The implementation by Worker M2 is robust, resilient to rapid mode switching and async races, completely releases hardware resources, and isolates optical tracking pause behavior from Normal Mode.

---

## 5. Verification Method

To independently verify this milestone:

```bash
# Run Milestone 2 lifecycle tests
npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts

# Run Challenger M2 adversarial stress suite
npx tsx --test tests/e2e/challenger_m2_stress.test.ts

# Run both suites together
npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts tests/e2e/challenger_m2_stress.test.ts
```

**Files to inspect:**
- `src/components/HandTracker.tsx` (Lines 214-266, 330-360, 400-435, 537-598)
- `src/components/PizzaCanvas.tsx` (Lines 631-655, 1050-1060, 1317-1339, 2266, 3445-3480)
- `tests/e2e/r2_camera_lifecycle.test.ts`
- `tests/e2e/challenger_m2_stress.test.ts`
- `.agents/challenger_m2_1/challenge_report.md`
