# Handoff Report: Milestone 2 (Requirement R2 - MediaPipe & Webcam Lifecycle Cleanup)

**Author:** Worker 2  
**Date:** 2026-08-18  
**Working Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\worker_m2_1`  
**Milestone:** Milestone 2 (Requirement R2)

---

## 1. Observation

Direct code observations from `src/components/HandTracker.tsx` and `src/components/PizzaCanvas.tsx`:
1. In `src/components/HandTracker.tsx`:
   - `handleStopTracking` (lines 507-544) previously only called `cancelAnimationFrame(frameIdRef.current)` and set `videoRef.current.srcObject = null` without calling `track.stop()` on all tracks, without `stream.removeTrack()`, without `video.pause()`, and without handling `cancelVideoFrameCallback`.
   - `injectScripts` (lines 223-255) had no cancellation token (`isCancelled`), allowing async loading to invoke `handleStartTracking()` even after unmount or mode switch.
   - `handleStartTracking` (lines 299-493) did not check `!isEnabledRef.current` before scheduling retries and did not remove tracks from the stream when disabled post-permission prompt.
2. In `src/components/PizzaCanvas.tsx`:
   - No `useEffect` monitored `controlMode` transitions to reset `isPaused` and hand coordinates.
   - In `updateLoop` (lines 1317-1336), `togglePause(false)` was only inside `if (isPlaying && controlMode === 'camera')`, preventing unpause when switching to `controlMode === 'mouse'`.
   - At line 2266, the `"⏸️ DETECCIÓN PERDIDA"` canvas overlay checked `if (isPlaying && isPausedRef.current)` without verifying `controlMode === 'camera'`.
   - On `isGameOver` (line 1050), `controlMode` remained `'camera'` while displaying score registration modals.

---

## 2. Logic Chain

1. **Hardware Stream & Memory Leaks**:
   - Calling `track.stop()` and `stream.removeTrack(track)` for all tracks in `streamRef.current.getTracks()` physically terminates camera hardware sensor capture and turns off the device LED indicator.
   - Calling `videoRef.current.pause()`, clearing `srcObject = null`, removing `src`, and invoking `load()` releases browser video decoding hardware pipeline resources.
   - Calling `video.cancelVideoFrameCallback(handle)` when present (or `cancelAnimationFrame(handle)`) terminates the tick loop reliably so no further frames are pushed to MediaPipe.
   - Invoking `handsInstanceRef.current.close()` frees the WebAssembly and WebGL context structures associated with MediaPipe Hands.
2. **Asynchronous Race Protection**:
   - Marking `isCancelled = true` on cleanup and verifying `!isEnabledRef.current` at all async continuation points ensures that any network delays during script fetching or permission dialog delays in `getUserMedia` abort safely without creating zombie streams.
3. **State Isolation & Unpause Guarantee**:
   - Adding a synchronization effect on `controlMode === 'mouse'` ensures `isPausedRef.current = false; setIsPaused(false); handDetectedRef.current = false; setHandDetected(false);` and wipes all camera coordinate buffers.
   - Adding a defensive unpause in `updateLoop` guarantees that Normal (Mouse/Touch) mode never freezes even if state was previously paused.
   - Setting `setControlMode('mouse')` in `isGameOver` shuts down the camera tracker immediately when the match concludes.

---

## 3. Caveats

- In browser environments that do not support `requestVideoFrameCallback`, the fallback `requestAnimationFrame` and `cancelAnimationFrame` are used automatically.
- MediaPipe CDN loading requires internet connectivity if local assets in `/mediapipe/` are not served; automated fallback between local and CDN is preserved.

---

## 4. Conclusion

All requirements for Milestone 2 (Requirement R2) are fully implemented:
- Full hardware stream teardown and track removal.
- Comprehensive video element pause, attribute removal, and reset.
- Correct `cancelVideoFrameCallback` and `cancelAnimationFrame` dispatch.
- MediaPipe instance closure and memory deallocation.
- Async race condition and permission prompt abort protection.
- State synchronization in PizzaCanvas ensuring mouse mode never inherits pause or hand loss overlays.
- Immediate camera deactivation upon game over and mode switches.

---

## 5. Verification Method

To independently verify these changes:
1. **Automated E2E Camera Lifecycle Test**:
   ```bash
   npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts
   ```
2. **TypeScript & Build Verification**:
   ```bash
   npm run lint # tsc --noEmit
   npm run build
   ```
3. **Inspection of Modified Files**:
   - Inspect `src/components/HandTracker.tsx` (teardown, cancellation, async tokens).
   - Inspect `src/components/PizzaCanvas.tsx` (`controlMode` synchronization effect, `isGameOver` camera cleanup, `updateLoop` unpause).
