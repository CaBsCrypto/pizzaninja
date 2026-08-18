# Milestone 2 Implementation Report: Requirement R2 (MediaPipe & Webcam Lifecycle Cleanup)

**Author:** Worker 2 (Implementer / QA / Specialist)  
**Date:** 2026-08-18  
**Scope:** `src/components/HandTracker.tsx`, `src/components/PizzaCanvas.tsx`  
**Milestone:** Milestone 2 (Requirement R2)

---

## Summary of Changes

### 1. `src/components/HandTracker.tsx`
- **Robust Hardware Stream Teardown**:
  - In `handleStopTracking`, iteratively stopped all active `MediaStreamTrack` instances using `track.stop()` and unlinked them with `stream.removeTrack(track)`.
  - Cleared `streamRef.current = null`.
- **Complete Video Element Release**:
  - Added explicit `videoRef.current.pause()` prior to clearing `srcObject = null`.
  - Removed `'src'` attribute and executed `videoRef.current.load()` to guarantee audio/video decoder pipeline deallocation.
- **Dual Callback Loop Cancellation**:
  - Implemented conditional cancellation for `video.cancelVideoFrameCallback(frameIdRef.current)` when supported by the browser engine (Chromium/Safari), with fallback to `cancelAnimationFrame(frameIdRef.current)`.
  - Cleared `frameIdRef.current = null`.
- **MediaPipe Instance Disposal**:
  - Executed `handsInstanceRef.current.close()` in `handleStopTracking` and `handleStartTracking` prior to re-instantiation, clearing references to free WebAssembly/WebGL memory.
- **Async Race Condition & Abort Guards**:
  - Added `let isCancelled = false` in `useEffect([isEnabled, sourceType])` to prevent script load completion from triggering `handleStartTracking` if the component unmounted or mode changed during the network request.
  - Added immediate checks for `!isEnabledRef.current` after `getUserMedia` resolution to stop and discard any streams acquired if the user disabled tracking during browser permission prompt modals.
  - Ensured unmount cleanup function in `useEffect` invokes `handleStopTracking()`.

### 2. `src/components/PizzaCanvas.tsx`
- **`controlMode` State Synchronization Effect**:
  - Added dedicated `useEffect` listening to `controlMode`:
    - Automatically forces `isPausedRef.current = false` and `setIsPaused(false)`.
    - Resets `handDetectedRef.current = false` and `setHandDetected(false)`.
    - Resets optical cursor tracking targets (`targetHandX/Y`), current positions (`currentHandX/Y`), velocity (`handVx/Vy`), and optical blade trails (`trail1`).
- **Defensive Unpause in Game Loop (`updateLoop`)**:
  - Added defensive check in `updateLoop`: if `controlMode === 'mouse'` and `isPausedRef.current` is true, immediately clears `isPausedRef.current = false` and `setIsPaused(false)`.
  - Prevented any possibility of optical tracking timeouts causing game freezes in mouse mode.
- **Isolated "DETECCIÓN PERDIDA" Overlay**:
  - Guarded the pause overlay drawing to strictly require `isPlaying && isPausedRef.current && controlMode === 'camera'`, preventing the warning banner from rendering in Normal Mode.
- **Game Over Camera Cleanup**:
  - In `isGameOver` (`PizzaCanvas.tsx`), added `isPausedRef.current = false; setIsPaused(false); setControlMode('mouse'); handDetectedRef.current = false; setHandDetected(false);` ensuring that when match finishes (time expires or lives reach 0), webcam streaming and inference terminate immediately prior to displaying the score registration modal or returning to menu.
- **Mode Switching Handlers**:
  - Updated "JUGAR NORMAL", "◀ VOLVER AL RATÓN", and `onFallbackToMouse` handlers to cleanly switch `controlMode` to `'mouse'` and reset all tracking states.

---

## Verification Strategy
- Static code analysis against all test assertions in `tests/e2e/r2_camera_lifecycle.test.ts`.
- Validated lifecycle states in mock state machine scenarios:
  1. Camera Mode -> Auto-pause after 2000ms threshold -> Auto-resume on hand coordinates.
  2. Switch from Camera Mode to Mouse Mode while in "DETECCIÓN PERDIDA" -> Immediate unpause and hardware stream teardown.
  3. Game Over in Camera Mode -> Immediate camera deactivation and unpause.
  4. Rapid mode toggling -> Clean stream shutdown on each toggle.
