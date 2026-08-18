# Forensic Audit & Handoff Report: Milestone 2 (Requirement R2)

**Auditor:** Forensic Auditor (critic, specialist, auditor)  
**Date:** 2026-08-18  
**Working Directory:** `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\auditor_m2_1`  
**Target:** Milestone 2 (MediaPipe & Webcam Lifecycle Cleanup - Requirement R2)  
**Profile:** General Project  
**Integrity Mode:** Development (per `ORIGINAL_REQUEST.md`)  
**Verdict:** **CLEAN**

---

## Forensic Audit Report

**Work Product**: `src/components/HandTracker.tsx`, `src/components/PizzaCanvas.tsx`, `tests/e2e/r2_camera_lifecycle.test.ts`, Worker M2 changes (`.agents/worker_m2_1/changes_m2.md`)  
**Profile**: General Project  
**Verdict**: **CLEAN**

### Phase 1: Mode-Agnostic Source Code Investigation
| Forensic Check | Status | Observations & Findings |
|---|---|---|
| 1. Hardcoded Test Results / Expected Outputs | **PASS** | No hardcoded PASS/FAIL flags, mock bypass strings, or pre-computed test returns in `src/components/HandTracker.tsx` or `src/components/PizzaCanvas.tsx`. |
| 2. Facade Implementations / Dummy Teardown | **PASS** | `handleStopTracking` and `controlMode` synchronization perform genuine, complete hardware track closures (`t.stop()`, `stream.removeTrack(t)`), animation frame cancellations (`cancelVideoFrameCallback` / `cancelAnimationFrame`), video element deallocation (`pause()`, `srcObject = null`, `removeAttribute('src')`, `load()`), and MediaPipe instance disposal (`hands.close()`). No dummy methods or no-ops detected. |
| 3. Fabricated Verification Outputs | **PASS** | Workspace contains no pre-populated log files, fake test summaries, or synthesized test attestations. |
| 4. Self-Certifying Tests | **PASS** | `tests/e2e/r2_camera_lifecycle.test.ts` implements thorough multi-tier state machine tests (Tiers 1-4) simulating time boundaries (2000ms pause threshold), rapid toggles, permission rejections, game over shutdowns, and cross-mode unpauses. |
| 5. Execution Delegation / Cheating Patterns | **PASS** | No external delegation or circumvention. MediaPipe integration and React lifecycle management are authored cleanly within repository boundaries. |

### Phase 2: Mode-Specific Flagging (Development Mode)
- In **Development Mode**, the forensic standard requires verifying authentic implementation logic and preventing fabricated outputs or facade stubs.
- All lifecycle methods, hardware cleanup routines, cancellation tokens, and state synchronization effects are genuine, production-grade implementations.
- **Zero integrity violations detected.**

---

## 1. Observation

Direct code observations from `src/components/HandTracker.tsx` and `src/components/PizzaCanvas.tsx`:

### `src/components/HandTracker.tsx`
1. **MediaStream Hardware Teardown (lines 554-569)**:
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
2. **Video Element & Hardware Pipeline Release (lines 571-579)**:
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
3. **Dual Callback Cancellation (lines 540-552)**:
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
4. **MediaPipe Instance Disposal (lines 581-588)**:
   ```typescript
   if (handsInstanceRef.current) {
     try {
       handsInstanceRef.current.close();
       addLog("Instancia de MediaPipe eliminada.");
     } catch (e) {}
     handsInstanceRef.current = null;
   }
   ```
5. **Async Script Injection & `getUserMedia` Race Cancellation (lines 214, 237, 263-266, 423-432)**:
   - `let isCancelled = false;` in `useEffect([isEnabled, sourceType])`.
   - On cleanup: `isCancelled = true; handleStopTracking();`.
   - Post `getUserMedia` resolution check:
     ```typescript
     if (!videoRef.current || !isEnabledRef.current) {
       if (stream) {
         stream.getTracks().forEach(t => {
           try { t.stop(); } catch (e) {}
           try { stream.removeTrack(t); } catch (e) {}
         });
       }
       return;
     }
     ```

### `src/components/PizzaCanvas.tsx`
1. **`controlMode` State Synchronization (lines 631-655)**:
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
2. **Defensive Unpause in `updateLoop` (lines 1335-1339)**:
   ```typescript
   } else if (controlMode === 'mouse' && isPausedRef.current) {
     isPausedRef.current = false;
     setIsPaused(false);
   }
   ```
3. **Isolated "DETECCIÓN PERDIDA" Overlay (lines 2266-2285)**:
   ```typescript
   if (isPlaying && isPausedRef.current && controlMode === 'camera') {
     // renders overlay
   }
   ```
4. **Game Over Teardown (lines 1050-1060)**:
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

---

## 2. Logic Chain

1. **Hardware Stream Teardown & Resource Deallocation**:
   - Calling `track.stop()` on every track retrieved from `streamRef.current.getTracks()` physically signals the browser engine and underlying operating system to deactivate the webcam sensor hardware, turning off the camera indicator LED.
   - Calling `stream.removeTrack(track)` detaches references so the stream object does not hold dangling hardware handles.
   - Invoking `video.pause()`, clearing `srcObject = null`, removing `src`, and calling `load()` flushes the video decoding pipeline and releases hardware-accelerated video buffers.
   - Invoking `handsInstanceRef.current.close()` releases internal WebAssembly runtime and WebGL contexts allocated by the MediaPipe graph.

2. **Loop & Async Race Condition Immunity**:
   - The dual loop cancellation logic checks for `cancelVideoFrameCallback` (used when `requestVideoFrameCallback` is active in Chromium/WebKit) and falls back to `cancelAnimationFrame`. Clearing `frameIdRef.current = null` guarantees no tick callbacks run after teardown.
   - Asynchronous operations (`loadScript` network fetch and `navigator.mediaDevices.getUserMedia` prompt) are safeguarded with `isCancelled` and `!isEnabledRef.current` guard checks. If a user rapidly toggles modes or leaves during a prompt, the newly acquired stream is immediately stopped and released before attaching to the DOM.

3. **State Isolation & Unpause Guarantee**:
   - The dedicated `useEffect([controlMode])` in `PizzaCanvas.tsx` guarantees that whenever the mode switches to `'mouse'`, `isPausedRef.current` and `isPaused` state are unconditionally cleared, hand detection flags are reset, and tracking coordinates/trails are scrubbed.
   - Defensive checks in `updateLoop` prevent optical latency timeouts from ever latching a pause state into Normal Mode.
   - The canvas pause overlay is strictly conditioned on `controlMode === 'camera'`, preventing "DETECCIÓN PERDIDA" from ever appearing during mouse/touch gameplay.
   - Game over logic switches `controlMode` to `'mouse'`, immediately triggering camera teardown.

---

## 3. Caveats

- **External MediaPipe CDN/Local Fallback**: MediaPipe loads WASM binaries via CDN (`jsdelivr`) with automated fallback to local `/mediapipe/`. In completely offline environments where `/mediapipe/` static assets are not served, initialization gracefully fails and invokes `onStatusChange('error')` / `onFallbackToMouse()`.
- **Browser API Variants**: Browsers without `requestVideoFrameCallback` seamlessly use the standard `requestAnimationFrame` fallback.

---

## 4. Conclusion

The implementation of Milestone 2 (Requirement R2) in `src/components/HandTracker.tsx` and `src/components/PizzaCanvas.tsx` is **AUTHENTIC, ROBUST, and CLEAN**:
1. No hardcoded test results, facade stubs, dummy flags, or cheating mechanisms exist.
2. Hardware camera streams, MediaPipe WASM instances, video elements, and animation frame callbacks are cleanly and reliably torn down.
3. State transitions between Camera Mode and Normal Mode are fully synchronized, preventing game freezes, leftover pause states, or orphaned overlays.
4. Final Forensic Verdict: **CLEAN**.

---

## 5. Verification Method

To independently verify these results:

1. **E2E Camera Lifecycle Test Suite Execution**:
   ```bash
   npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts
   ```
2. **Code Inspection**:
   - Inspect `src/components/HandTracker.tsx` (lines 214-266, 330-350, 420-435, 508-598)
   - Inspect `src/components/PizzaCanvas.tsx` (lines 631-655, 1050-1060, 1319-1340, 2266-2285)
3. **Type & Build Check**:
   ```bash
   npm run lint # tsc --noEmit
   npm run build
   ```
