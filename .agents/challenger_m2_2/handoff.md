# Handoff Report: Milestone 2 Empirical Challenge (MediaPipe & Webcam Lifecycle Cleanup - Requirement R2)

**Agent Role**: Challenger 2 (Empirical Challenger / Critic / Specialist)  
**Milestone**: Milestone 2 (Requirement R2)  
**Verdict**: **APPROVE**  
**Date**: 2026-08-18  

---

## 1. Observation

### 1.1 Hardware Stream Teardown & MediaPipe Disposal (`src/components/HandTracker.tsx`)
- **Track Deactivation & Detachment** (`lines 555-569`):
  ```typescript
  if (streamRef.current) {
    try {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        try { track.stop(); } catch (e) {}
        try { streamRef.current?.removeTrack(track); } catch (e) {}
        addLog("Canal de cámara cerrado.");
      });
    } catch (e) {}
    streamRef.current = null;
  }
  ```
- **Video Element Decoder Release** (`lines 572-579`):
  ```typescript
  if (videoRef.current) {
    try {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    } catch (e) {}
  }
  ```
- **Dual Callback Loop Cancellation** (`lines 541-552`):
  ```typescript
  if (frameIdRef.current !== null) {
    if (videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
      try { (videoRef.current as any).cancelVideoFrameCallback(frameIdRef.current); } catch (e) {}
    } else {
      try { cancelAnimationFrame(frameIdRef.current); } catch (e) {}
    }
    frameIdRef.current = null;
  }
  ```
- **MediaPipe WASM Instance Disposal** (`lines 582-588`):
  ```typescript
  if (handsInstanceRef.current) {
    try {
      handsInstanceRef.current.close();
      addLog("Instancia de MediaPipe eliminada.");
    } catch (e) {}
    handsInstanceRef.current = null;
  }
  ```
- **In-Flight `getUserMedia` Abort Guard** (`lines 423-432`):
  ```typescript
  if (!videoRef.current || !isEnabledRef.current) {
    addLog("Detección suspendida post-aprobación del usuario.");
    if (stream) {
      stream.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
        try { stream.removeTrack(t); } catch (e) {}
      });
    }
    return;
  }
  ```

### 1.2 Pause Synchronization & Game Over Reset (`src/components/PizzaCanvas.tsx`)
- **`controlMode` Change Reset Effect** (`lines 632-655`):
  ```typescript
  useEffect(() => {
    if (controlMode === 'mouse') {
      isPausedRef.current = false;
      setIsPaused(false);
      handDetectedRef.current = false;
      setHandDetected(false);
      if (stateRef.current) {
        stateRef.current.targetHandX = [0, 0];
        stateRef.current.targetHandY = [0, 0];
        stateRef.current.currentHandX = [undefined, undefined];
        stateRef.current.currentHandY = [undefined, undefined];
        stateRef.current.lastRawX = [undefined, undefined];
        stateRef.current.lastRawY = [undefined, undefined];
        stateRef.current.handVx = [0, 0];
        stateRef.current.handVy = [0, 0];
        stateRef.current.trail1 = [];
      }
    }
  }, [controlMode]);
  ```
- **Defensive Unpause in Game Loop** (`lines 1335-1339`):
  ```typescript
  else if (controlMode === 'mouse' && isPausedRef.current) {
    isPausedRef.current = false;
    setIsPaused(false);
  }
  ```
- **Isolated Pause Banner Rendering** (`lines 2266-2270`):
  ```typescript
  if (isPlaying && isPausedRef.current && controlMode === 'camera') {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 13, 20, 0.88)';
    ctx.fillRect(0, 0, width, height);
    // Render DETECCIÓN PERDIDA banner
  ```
- **Optical Hand Coordinate Ingestion Gate** (`line 2744`):
  ```typescript
  const handleHandCoordsTracked = (normX: number, normY: number, handIdx: number, isEngaged: boolean) => {
    if (controlMode !== 'camera') return;
  ```
- **Game Over Camera Reset** (`lines 1050-1060`):
  ```typescript
  if (isGameOver) {
    clearInterval(clockInterval);
    setIsPlaying(false);
    isPausedRef.current = false;
    setIsPaused(false);
    setControlMode('mouse');
    handDetectedRef.current = false;
    setHandDetected(false);
  ```

### 1.3 Empirical Test Execution
- Executed `npm test` covering both `tests/e2e/r2_camera_lifecycle.test.ts` and `tests/e2e/challenger_m2_empirical_stress.test.ts`.
- Results:
  - `tests/e2e/r2_camera_lifecycle.test.ts`: **100% Passed** (Tier 1-4 suites).
  - `tests/e2e/challenger_m2_empirical_stress.test.ts`: **100% Passed** (6/6 stress scenarios).

---

## 2. Logic Chain

1. **Hardware Track Deactivation (`readyState === 'ended'`)**:
   - Calling `track.stop()` invokes the standard W3C Media Capture procedure setting `track.readyState = 'ended'` and stopping media production.
   - `stream.removeTrack(track)` detaches track handles from the active stream.
   - `video.pause()`, `video.srcObject = null`, and `video.load()` flush decoder queues, guaranteeing full deallocation of webcam hardware.

2. **Normal/Mouse Mode Immunity to Optical Interruption**:
   - `handleHandCoordsTracked` aborts immediately if `controlMode !== 'camera'`, preventing external tracking events from affecting mouse mode.
   - The game loop's optical latency check is guarded by `controlMode === 'camera'`.
   - If the game was paused prior to switching modes, `useEffect([controlMode])` and `updateLoop` immediately force `isPausedRef.current = false`, clearing pause state.
   - The "DETECCIÓN PERDIDA" overlay is guarded by `controlMode === 'camera'`, preventing it from rendering in normal mode.

3. **Game Over Lifecycle Guarantees**:
   - On match termination (`isGameOver`), `setControlMode('mouse')` and `isPausedRef.current = false` are executed synchronously.
   - Transitioning `controlMode` to `'mouse'` unmounts `HandTracker`, which triggers its unmount cleanup hook and stops all hardware streams before the Game Over UI renders.

4. **Async Permission & Injection Race Conditions**:
   - `isCancelled` tokens in `useEffect` and `!isEnabledRef.current` post-`getUserMedia` checks guarantee that delayed user interaction or cancellation during permission prompts never results in orphaned running streams.

---

## 3. Caveats

- **Out of Scope**: Milestone 1 issue 3.3 (`r1_responsive_viewport.test.ts`) failed due to a legacy drawer query assertion, which is unrelated to Milestone 2 camera lifecycle.
- **Platform Feature Detection**: Browsers without `requestVideoFrameCallback` fallback cleanly to `requestAnimationFrame`.

---

## 4. Conclusion

- **Verdict**: **APPROVE**
- The Worker's Milestone 2 implementation satisfies all Requirement R2 criteria:
  1. Complete hardware teardown (`track.stop()`, `readyState === 'ended'`, `srcObject = null`, `hands.close()`).
  2. Absolute unpause guarantees upon switching to mouse mode (`isPausedRef.current = false`).
  3. Total isolation of mouse mode from hand detection lost events and warning overlays.
  4. Immediate camera shutdown upon game over.

---

## 5. Verification Method

To independently reproduce and verify this assessment, run the test suites:
```bash
npm test
```
Or run the dedicated Milestone 2 empirical test files:
```bash
npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts tests/e2e/challenger_m2_empirical_stress.test.ts
```
Expected result: All R2 lifecycle and stress assertions pass with 0 failures.
