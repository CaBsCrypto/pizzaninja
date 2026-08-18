# Survey Report: Requirement R2 (Camera State Deactivation & Lifecycle Cleanup)

**Author:** Explorer 2  
**Date:** 2026-08-18  
**Scope:** MediaPipe Hands, Webcam Stream Lifecycle, Animation Frame Loops, Pause State Persistence, Mode Switching (Camera Mode ↔ Normal Mode), Main Menu Return, and "Detección Perdida" Resolution.  
**Target Project:** Slash Slice Arena (`C:\Users\MGC\Documents\antigravity\blissful-hawking`)

---

## 1. Executive Summary

Requirement R2 addresses critical lifecycle and state management bugs in *Slash Slice Arena* when utilizing optical tracking (MediaPipe Hands / Webcam) and transitioning between **Modo Cámara (Camera Mode)** and **Modo Normal (Mouse/Touch Mode)** or returning to the **Main Menu**:

1. **Camera Hardware & Stream Persistence**: When a match in Camera Mode ends (Game Over), when returning to the main menu, or when skipping score registration, the webcam stream and MediaPipe detection pipeline remain active in the background, consuming CPU/GPU and leaving the camera hardware LED on.
2. **Permanent Freeze & "Detección Perdida" in Normal Mode**: When hand tracking loses coordinates for >2.0s, `isPausedRef.current` is set to `true` and the overlay `"⏸️ DETECCIÓN PERDIDA"` is rendered. If the user then switches to Normal Mode (or triggers fallback to mouse, or starts a normal game), the unpause logic only exists inside `if (isPlaying && controlMode === 'camera')`. Because `controlMode` is `'mouse'`, the game **never unpauses**, freezing physics, item spawning, and countdown timers while displaying the hand detection error overlay over mouse controls.
3. **Asynchronous Race Conditions & Incomplete Teardown**: In `HandTracker.tsx`, video frame callbacks registered via `requestVideoFrameCallback` are incorrectly cancelled via `cancelAnimationFrame`, video elements are not paused before clearing `srcObject`, and async in-flight requests (`getUserMedia` and script loader) lack cancellation checks, allowing zombie streams to open post-mode switch.

---

## 2. Involved Source Files and Components

| File Path | Role in R2 Lifecycle | Key Functions & Lines |
| :--- | :--- | :--- |
| `src/components/HandTracker.tsx` | Optical sensor controller, MediaPipe Hands pipeline, camera acquisition, animation frame loops, canvas overlay, stream disposal. | `handleStartTracking` (L298-422), `handleStopTracking` (L507-544), `scheduleNextTick`/`tick` (L433-488), `injectScripts` (L223-255). |
| `src/components/PizzaCanvas.tsx` | Game loop engine, `controlMode` state (`'mouse'` \| `'camera'`), `isPaused` management, auto-pause on tracking loss, "DETECCIÓN PERDIDA" rendering, menu overlays, start pizza calibration. | `togglePause` (L620-629), `startGame` (L631-686), `isGameOver` (L1024-1050), `updateLoop` (L1271-2258), `handlePointerDown/Move` (L2291-2340), `handleHandCoordsTracked` (L2695-2852), Menu overlays (L3094-3218), `HandTracker` mounting (L3400-3435). |
| `src/App.tsx` | Root UI coordinator, game over handler, score registration popup, menu transitions, modal state. | `handleGameOver` (L223-245), `scoreRegistrationCard` (L321-602), "Omitir registro" (L570, L596). |
| `src/types.ts` | Global type definitions for scores, replays, and game modes. | `ScoreRecord`, `SlashReplayPoint`, `GameMode`. |

---

## 3. Deep Root-Cause Analysis

### Flaw A: `isPaused` State Leak into Normal/Mouse Mode
* **Location**: `src/components/PizzaCanvas.tsx:1283-1301`, `src/components/PizzaCanvas.tsx:2228-2256`, `src/components/PizzaCanvas.tsx:1005-1007`, `src/components/PizzaCanvas.tsx:1325`.
* **Mechanism**:
  1. In `PizzaCanvas.tsx:1285-1301`, when `isPlaying && controlMode === 'camera'`, if hand tracking coordinates are missing for >2000ms, `togglePause(true)` sets `isPausedRef.current = true; setIsPaused(true);`.
  2. If the user clicks **"◀ VOLVER AL RATÓN"** (`setControlMode('mouse')`), clicks **"JUGAR NORMAL"**, triggers `onFallbackToMouse`, or ends the game while paused:
     - `controlMode` becomes `'mouse'`.
     - `isPausedRef.current` remains `true`.
  3. During `updateLoop`:
     ```ts
     // PizzaCanvas.tsx:1285
     if (isPlaying && controlMode === 'camera') {
       // Only runs in camera mode!
       if (isPausedRef.current && elapsed < 600) {
         togglePause(false);
       }
     }
     ```
     Because `controlMode !== 'camera'`, the resume check **never executes**.
  4. At `PizzaCanvas.tsx:2228`:
     ```ts
     if (isPlaying && isPausedRef.current) {
       ctx.fillText('⏸️ DETECCIÓN PERDIDA', width / 2, height / 2 - 30);
       ctx.fillText('¡MAMMA MIA! SE HA PERDIDO EL SECTOR DE TU MANO', width / 2, height / 2 + 15);
       ctx.fillText('Muestra tu mano frente a la cámara para reanudar automáticamente...', width / 2, height / 2 + 40);
     }
     ```
     The pause overlay is permanently drawn on the screen.
  5. Item spawning (`if (isPlaying && !isPaused)`) at line 1325 and clock countdown (`if (isPausedRef.current) return;`) at line 1006 are permanently halted. The game is completely frozen in normal mouse mode.

---

### Flaw B: Camera Stream Not Stopped on Game Over, Menu Return, or Skip Registration
* **Location**: `src/components/PizzaCanvas.tsx:1024-1050`, `src/components/PizzaCanvas.tsx:3094`, `src/App.tsx:223-245`, `src/App.tsx:596-598`.
* **Mechanism**:
  1. When a game in Camera Mode ends (timer runs out or 3 lives lost), `isGameOver` sets `setIsPlaying(false)` and calls `onGameOver(...)`.
  2. `controlMode` remains `'camera'`.
  3. `PizzaCanvas.tsx:3400` mounts `<HandTracker isEnabled={controlMode === 'camera'} />`. Because `controlMode` is still `'camera'`, `HandTracker` remains mounted and active.
  4. While the user is on the Score Registration modal (in `App.tsx`) or clicks "Omitir registro y volver al menú", `controlMode` is never reset to `'mouse'`, nor is `handleStopTracking()` called.
  5. The webcam hardware remains energized, the video stream continues capturing, and MediaPipe continues WASM inference in the background while the user is in menus or navigating other views (Shop, Stellar Hub).
  6. Furthermore, on the main menu, line 3094 checks:
     ```tsx
     {!isPlaying && !isRegistering && !(controlMode === 'camera' && handDetected) && ( ... )}
     ```
     If `controlMode` is `'camera'`, the user does not see the normal main menu ("JUGAR NORMAL" / "JUGAR CÁMARA"), but instead sees either the camera waiting banner (`📷 ACERCA TU MANO A LA CÁMARA...`) or the floating Start Pizza on canvas.

---

### Flaw C: Loop Cancellation Mismatch (`requestVideoFrameCallback` vs `cancelAnimationFrame`)
* **Location**: `src/components/HandTracker.tsx:478-486`, `src/components/HandTracker.tsx:510-513`.
* **Mechanism**:
  1. In `HandTracker.tsx:482`:
     ```ts
     if ('requestVideoFrameCallback' in vid) {
       frameIdRef.current = vid.requestVideoFrameCallback(tick);
     } else {
       frameIdRef.current = requestAnimationFrame(() => tick());
     }
     ```
  2. In `HandTracker.tsx:510-513` (`handleStopTracking`):
     ```ts
     if (frameIdRef.current) {
       cancelAnimationFrame(frameIdRef.current);
       frameIdRef.current = null;
     }
     ```
  3. In W3C/HTML5 Video specification, `requestVideoFrameCallback` returns a distinct integer handle that **must** be cancelled via `videoElement.cancelVideoFrameCallback(handle)`. Calling `window.cancelAnimationFrame(handle)` is a no-op for video frame callbacks, allowing subsequent `tick` callbacks to trigger.

---

### Flaw D: Video Element Not Paused and Leaked MediaStream References
* **Location**: `src/components/HandTracker.tsx:525-528`.
* **Mechanism**:
  1. In `handleStopTracking`:
     ```ts
     if (videoRef.current) {
       videoRef.current.srcObject = null;
     }
     ```
  2. The video element is not explicitly paused (`videoRef.current.pause()`). In several mobile browsers (WebKit on iOS, Chrome Android), unlinking `srcObject` without calling `pause()` can cause background decoding threads to stall or leak memory.
  3. `videoRef.current.load()` or `srcObject = null` after `pause()` ensures complete release of audio/video capture pipelines.

---

### Flaw E: Async Race Conditions during MediaPipe Loading & `getUserMedia`
* **Location**: `src/components/HandTracker.tsx:223-255`, `src/components/HandTracker.tsx:375-402`.
* **Mechanism**:
  1. In `injectScripts()`:
     ```ts
     await loadScript(...);
     setCdnStatus('loaded');
     handleStartTracking();
     ```
     If the user quickly toggles between Camera and Normal Mode (or unmounts the component) while the scripts are downloading (which takes 500-2500ms), `injectScripts` continues to completion and invokes `handleStartTracking()`, opening the camera even though `isEnabled` is now `false`.
  2. In `handleStartTracking()`:
     ```ts
     stream = await navigator.mediaDevices.getUserMedia(constraints);
     ```
     If `handleStopTracking()` was called while the user browser permission dialog was open, `streamRef.current` was `null` when `handleStopTracking` ran. When `getUserMedia` resolves, if `isEnabledRef.current` was false, lines 398-402 stop the tracks, but if `isEnabledRef.current` is not updated synchronously or if the component re-entered, the newly created stream may leak.

---

### Flaw F: Missing State Synchronization on `controlMode` Changes in `PizzaCanvas`
* **Location**: `src/components/PizzaCanvas.tsx:66`, `src/components/PizzaCanvas.tsx:3174-3215`, `src/components/PizzaCanvas.tsx:3420-3430`.
* **Mechanism**:
  1. There is currently **no `useEffect` listening to `controlMode`** in `PizzaCanvas.tsx`.
  2. When `controlMode` changes from `'camera'` to `'mouse'`:
     - `isPausedRef.current` and `isPaused` state are not reset to `false`.
     - `handDetectedRef.current` and `handDetected` state are not reset to `false`.
     - `lastHandTrackedTimeRef.current` is not reset.
     - `stateRef.current.trail` and `trail1` are not cleared.
     - `stateRef.current.currentHandX/Y` and `targetHandX/Y` are not reset.

---

## 4. Execution Trace & Scenarios

### Scenario 1: Camera Mode Gameplay → Game Over → Normal Mode
```
[User clicks "JUGAR CÁMARA"]
  ↳ controlMode = 'camera'
  ↳ HandTracker mounts, getUserMedia granted, MediaPipe starts inference loop
[User plays and loses lives or time expires]
  ↳ PizzaCanvas: isGameOver triggered
  ↳ isPlaying = false, onGameOver(score)
  ↳ App.tsx: pendingScore != null (Score Registration modal opens)
  ↳ BUG: controlMode is still 'camera', camera is still ON
[User clicks "Omitir registro y volver al menú"]
  ↳ App.tsx: pendingScore = null, isRegistering = false
  ↳ PizzaCanvas: Main Menu displays Camera Waiting UI ("ACERCA TU MANO...")
[User clicks "JUGAR NORMAL"]
  ↳ PizzaCanvas: setControlMode('mouse'), initiateCountdown()
  ↳ HandTracker unmounts
  ↳ BUG: If isPaused was true during camera game over, isPausedRef.current is still TRUE
  ↳ Normal Game starts: Screen displays "DETECCIÓN PERDIDA", game is completely frozen
```

### Scenario 2: Camera Mode → Hand Lost (Auto-Pause) → Switch to Mouse
```
[Camera mode active in game]
  ↳ User removes hands for > 2.0s
  ↳ PizzaCanvas: elapsed > 2000ms -> togglePause(true) -> isPausedRef.current = true
  ↳ Screen shows "⏸️ DETECCIÓN PERDIDA"
[User switches to mouse control via UI or fallback]
  ↳ setControlMode('mouse')
  ↳ PizzaCanvas: updateLoop camera unpause block (L1285) is bypassed
  ↳ isPausedRef.current remains TRUE indefinitely
  ↳ Game remains stuck in "⏸️ DETECCIÓN PERDIDA" in Normal Mode
```

---

## 5. Precise Code Locations & Recommendations

### 1. Fix in `src/components/PizzaCanvas.tsx`: Centralized `controlMode` & Lifecycle Effect

Add a dedicated synchronization effect for `controlMode` transitions and game reset in `PizzaCanvas.tsx`:

```tsx
// Synchronize and sanitize state whenever controlMode changes or game ends
useEffect(() => {
  if (controlMode === 'mouse') {
    // 1. Force reset pause state so normal mode NEVER inherits camera pause
    isPausedRef.current = false;
    setIsPaused(false);
    
    // 2. Clear hand detection states
    handDetectedRef.current = false;
    setHandDetected(false);
    
    // 3. Clear camera-specific trails and coordinates
    stateRef.current.targetHandX = [0, 0];
    stateRef.current.targetHandY = [0, 0];
    stateRef.current.currentHandX = [undefined, undefined];
    stateRef.current.currentHandY = [undefined, undefined];
    stateRef.current.lastRawX = [undefined, undefined];
    stateRef.current.lastRawY = [undefined, undefined];
    stateRef.current.trail1 = [];
  }
}, [controlMode]);
```

In `isGameOver` (`PizzaCanvas.tsx:1024-1050`):
```tsx
if (isGameOver) {
  clearInterval(clockInterval);
  setIsPlaying(false);
  
  // Ensure pause state is cleared on game over
  isPausedRef.current = false;
  setIsPaused(false);
  
  // Optionally reset controlMode to 'mouse' or ensure camera cleanly sleeps
  setControlMode('mouse');
  
  playWebSound('gameover');
  ...
}
```

In `updateLoop` (`PizzaCanvas.tsx:1283-1301`):
Ensure pause check is strictly guarded and never affects mouse mode:
```tsx
if (isPlaying && controlMode === 'camera') {
  const nowMs = Date.now();
  const lastTracked = Math.max(lastHandTrackedTimeRef.current[0] || nowMs, lastHandTrackedTimeRef.current[1] || nowMs);
  const elapsed = nowMs - lastTracked;
  const gameRunningFor = nowMs - (stateRef.current.startTime || nowMs);

  if (elapsed > 2000 && gameRunningFor > 1500) {
    if (!isPausedRef.current) {
      togglePause(true);
    }
  } else if (isPausedRef.current && elapsed < 600) {
    togglePause(false);
  }
} else if (controlMode === 'mouse' && isPausedRef.current) {
  // Defensive guarantee: mouse mode MUST NEVER remain paused by optical tracking loss
  togglePause(false);
}
```

In `PizzaCanvas.tsx:2228` (Pause Overlay rendering):
Guard the "DETECCIÓN PERDIDA" overlay so it only renders when in `controlMode === 'camera'`:
```tsx
// 8. Draw high-tech pause overlay on the screen (ONLY for camera mode detection loss)
if (isPlaying && isPausedRef.current && controlMode === 'camera') {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 13, 20, 0.88)';
  ctx.fillRect(0, 0, width, height);
  ...
}
```

---

### 2. Fix in `src/components/HandTracker.tsx`: Complete Stream & Loop Teardown

In `handleStopTracking` (`src/components/HandTracker.tsx:507-544`):
```tsx
const handleStopTracking = () => {
  addLog("Apagando sensor de forma segura...");
  
  // 1. Cancel requestVideoFrameCallback or requestAnimationFrame properly
  if (videoRef.current && 'cancelVideoFrameCallback' in videoRef.current && frameIdRef.current) {
    try {
      (videoRef.current as any).cancelVideoFrameCallback(frameIdRef.current);
    } catch (e) {}
  } else if (frameIdRef.current) {
    try {
      cancelAnimationFrame(frameIdRef.current);
    } catch (e) {}
  }
  frameIdRef.current = null;

  // 2. Stop all media stream tracks immediately
  if (streamRef.current) {
    try {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addLog("Canal de cámara cerrado.");
      });
    } catch (e) {}
    streamRef.current = null;
  }

  // 3. Pause video and clear srcObject
  if (videoRef.current) {
    try {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    } catch (e) {}
  }

  // 4. Close MediaPipe instance
  if (handsInstanceRef.current) {
    try {
      handsInstanceRef.current.close();
      addLog("Instancia de MediaPipe eliminada.");
    } catch (e) {}
    handsInstanceRef.current = null;
  }

  setModelStatus('off');
  setHandDetected(false);
  onHandPresenceChange?.(false);
  if (onStatusChange) onStatusChange('inactive');

  lastXRef.current = [null, null];
  lastYRef.current = [null, null];
  addLog("Sensor apagado.");
};
```

In `injectScripts` (`src/components/HandTracker.tsx:212-255`):
Add cancellation guarding:
```tsx
useEffect(() => {
  let isCancelled = false;

  if (!isEnabled) {
    handleStopTracking();
    return;
  }

  const injectScripts = async () => {
    try {
      if (sourceType === 'local') {
        await loadScript('/mediapipe/camera_utils.js');
        await loadScript('/mediapipe/hands.js');
      } else {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
      }
      
      if (isCancelled || !isEnabledRef.current) {
        return; // Abort if disabled during script fetch
      }

      setCdnStatus('loaded');
      handleStartTracking();
    } catch (err: any) {
      if (isCancelled) return;
      ...
    }
  };

  injectScripts();

  return () => {
    isCancelled = true;
    handleStopTracking();
  };
}, [isEnabled, sourceType]);
```

---

## 6. Verification and Test Plan

1. **Compilability & Quality Checks**:
   - Run `npm run build` (verifies Vite bundling of all MediaPipe loaders and canvas components).
   - Check `npm run lint` (`tsc --noEmit`). Note: `App_old.tsx` has obsolete leftover syntax errors from an old backup that should either be excluded in `tsconfig.json` or cleaned up so `npm run lint` passes cleanly.
2. **Empirical Camera Mode Transition Test**:
   - Launch application in browser.
   - Enter **"JUGAR CÁMARA"**. Verify webcam activates (camera LED on).
   - Cut start pizza or begin match. Obstruct or remove hand to trigger `"⏸️ DETECCIÓN PERDIDA"`.
   - Click **"◀ VOLVER AL RATÓN"** or wait for game over.
   - Verify camera hardware indicator immediately turns OFF (`stream.getTracks().forEach(t => t.stop())`).
   - Start a game in **"JUGAR NORMAL"**.
   - Verify game runs smoothly at 60 FPS, accepts mouse/touch swipes, spawn interval timer counts down from 45s without pause, and **no "DETECCIÓN PERDIDA" overlay or freeze occurs**.
3. **Automated Unit / Integration Tests**:
   - Add automated test verifying that when `controlMode` switches to `'mouse'`, `isPaused` defaults to `false`, `handDetected` is `false`, and `HandTracker` cleans up all active MediaStreams.

---

## 7. Conclusion

Requirement R2 has been thoroughly diagnosed down to exact file paths, line numbers, and asynchronous race conditions. Implementing the recommendations above will fully satisfy Requirement R2 and ensure clean, leak-free camera transitions with zero freezes in Normal Mode.
