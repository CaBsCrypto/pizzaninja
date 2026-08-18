# Handoff Report — Requirement R2: Camera State Deactivation & Lifecycle Cleanup

## 1. Observation

### Source Code Findings
1. **`src/components/PizzaCanvas.tsx`**:
   - Lines 617-629: `isPaused` and `isPausedRef` are manipulated by `togglePause()`.
   - Lines 1005-1007: `clockInterval` pauses if `isPausedRef.current` is true (`if (isPausedRef.current) return;`).
   - Line 1024-1050: `isGameOver` sets `setIsPlaying(false)` and calls `onGameOver(...)`, but **does NOT reset `isPaused` or `controlMode`**.
   - Lines 1285-1301: Auto-pause triggers when `isPlaying && controlMode === 'camera'` and tracking gap > 2000ms. The unpause logic (`if (isPausedRef.current && elapsed < 600) togglePause(false);`) **only exists within this camera mode branch**.
   - Line 1325: `if (isPlaying && !isPaused)` guards item spawning and physics updates.
   - Lines 2228-2256: Renders `"⏸️ DETECCIÓN PERDIDA"` whenever `isPlaying && isPausedRef.current` is true.
   - Lines 3094: Main menu visibility is guarded by `{!isPlaying && !isRegistering && !(controlMode === 'camera' && handDetected)}`.
   - Lines 3176-3185: "JUGAR NORMAL" button calls `setControlMode('mouse'); initiateCountdown();`, but lacks synchronization to clear `isPausedRef.current` or `handDetectedRef.current`.
   - Lines 3210-3216: "VOLVER AL RATÓN" button calls `setControlMode('mouse')`, but does not reset `isPaused` or `handDetected`.
   - Lines 3400-3435: `<HandTracker isEnabled={controlMode === 'camera'} />` is mounted conditionally on `controlMode === 'camera'`.

2. **`src/components/HandTracker.tsx`**:
   - Lines 223-255: `injectScripts()` has no cancellation check on `isEnabled` if unmounted or switched to mouse while scripts are downloading.
   - Lines 375-402: `getUserMedia()` request loop lacks an unmount cancellation token before assigning `streamRef.current`.
   - Lines 480-486: Uses `vid.requestVideoFrameCallback(tick)` when available in modern browsers.
   - Lines 510-513: In `handleStopTracking()`, calls `cancelAnimationFrame(frameIdRef.current)`. It does **not** call `vid.cancelVideoFrameCallback(frameIdRef.current)`.
   - Lines 525-528: Clears `videoRef.current.srcObject = null` without calling `videoRef.current.pause()`.

3. **Build & Lint Commands**:
   - Command: `npm run build` exits with code 0 (Vite build successful).
   - Command: `npm run lint` (`tsc --noEmit`) reports syntax errors in `App_old.tsx` (an obsolete backup file).

---

## 2. Logic Chain

1. When playing in Camera Mode, if hand detection drops for >2.0 seconds, `togglePause(true)` sets `isPausedRef.current = true`.
2. If the user then switches to Normal Mode (`controlMode = 'mouse'`), either via "VOLVER AL RATÓN", "JUGAR NORMAL", `onFallbackToMouse`, or starting a new game after skipping registration, `controlMode` becomes `'mouse'` while `isPausedRef.current` remains `true`.
3. Inside `updateLoop`, line 1285 (`if (isPlaying && controlMode === 'camera')`) does not execute in mouse mode, meaning `togglePause(false)` is never called.
4. Because `isPausedRef.current` remains `true`, line 2228 renders `"⏸️ DETECCIÓN PERDIDA"` permanently, line 1325 skips spawning pizzas, and line 1006 halts the timer, freezing the entire game in Normal Mode.
5. In `HandTracker.tsx`, `handleStopTracking` fails to cancel `requestVideoFrameCallback` and lacks `videoRef.current.pause()`, while `injectScripts` and `handleStartTracking` lack cancellation tokens. Thus, asynchronous operations can start new streams or execute callbacks even after mode switching.
6. When exiting a match (`isGameOver`) or returning to the main menu from the score modal, `controlMode` is not reset to `'mouse'`, leaving the webcam stream active in the background and locking the menu in Camera Mode state.

---

## 3. Caveats

- `App_old.tsx` is an unused legacy backup file in the repository root that causes `npm run lint` to fail; it does not affect runtime execution of `src/App.tsx`.
- MediaPipe Hands CDN/local loading behavior depends on browser permissions and network availability, making the cancellation token in `injectScripts()` critical for flaky connections.

---

## 4. Conclusion

The root causes of Bug 2 (Requirement R2) are fully identified:
1. `isPaused` leaks into Normal Mode because unpause logic is strictly scoped to `controlMode === 'camera'`.
2. Camera streams and MediaPipe instances persist because `controlMode` is not reset on Game Over / menu returns, and `HandTracker.tsx` has teardown mismatches (`requestVideoFrameCallback` cancellation and missing `video.pause()`).
3. Adding a centralized `useEffect` in `PizzaCanvas.tsx` for `controlMode === 'mouse'`, resetting `isPaused` on game over and mode switches, and updating `handleStopTracking()` in `HandTracker.tsx` will permanently resolve Bug 2.

---

## 5. Verification Method

1. **Compilability**:
   Run `npm run build`. Verify bundle succeeds without errors.
2. **Transition Test**:
   - Select "JUGAR CÁMARA". Confirm webcam stream begins.
   - Hide hand to trigger `"⏸️ DETECCIÓN PERDIDA"`.
   - Click "VOLVER AL RATÓN" or end game and click "JUGAR NORMAL".
   - Verify webcam turns off (`stream.getTracks().forEach(t => t.stop())`).
   - Verify Normal Mode plays immediately at 60 FPS with mouse/touch slashing, with no pause overlay and normal timer countdown.
3. **Inspect Output Files**:
   - `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_r2\survey_r2.md`
