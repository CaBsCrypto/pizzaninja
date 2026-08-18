## 2026-08-18T20:46:26Z
You are Worker 2 for Milestone 2 (MediaPipe & Webcam Lifecycle Cleanup - Requirement R2).
Your working directory is: C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\worker_m2_1

Read:
- ORIGINAL_REQUEST.md at C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\ORIGINAL_REQUEST.md (under latest follow-up header)
- PROJECT.md at C:\Users\MGC\Documents\antigravity\blissful-hawking\PROJECT.md
- Survey R2 report at C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_r2\survey_r2.md

Exclusive Write Ownership:
- `src/components/HandTracker.tsx`
- `src/components/PizzaCanvas.tsx` (camera lifecycle, unpause state sync, mode transitions, game over cleanup)

Your task:
Implement all required changes for Milestone 2 / Requirement R2:
1. `src/components/HandTracker.tsx`:
   - Hardware stream teardown: Ensure `stream.getTracks().forEach(track => { track.stop(); stream.removeTrack(track); })` is called reliably.
   - Video element cleanup: Call `video.pause()`, clear `video.srcObject = null`, clear video attributes.
   - Callback cancellation: Properly cancel `video.cancelVideoFrameCallback(handle)` when supported and/or `cancelAnimationFrame(handle)`.
   - MediaPipe instance disposal: Ensure `hands.close()` or equivalent is cleanly executed.
   - Race condition prevention: Add cancellation / abort tokens for in-flight `injectScripts` and async `navigator.mediaDevices.getUserMedia` calls so an unmount or mode toggle during loading safely aborts without leaving background streams.
   - In `useEffect` cleanup return function, guarantee full teardown is invoked.
2. `src/components/PizzaCanvas.tsx`:
   - Reset `isPaused` and `isHandLost` state: When `controlMode === 'mouse'`, immediately ensure `isPausedRef.current = false`, `setIsHandLost(false)`, and `stateRef.current.isPaused = false`.
   - Never allow "DETECCIÓN PERDIDA" overlay or pause state to linger when in Normal/Mouse mode.
   - When switching modes (e.g. clicking "JUGAR NORMAL" or exiting to menu), ensure camera is deactivated and state is completely reset.
   - On game over, ensure camera tracking is disabled or reset to prevent background webcam streaming during score registration or main menu.
3. Verification:
   - Run `npm run lint` (`npx tsc --noEmit`)
   - Run `npx tsx --test tests/e2e/r2_camera_lifecycle.test.ts`
   - Run `npm run build`
   - Document commands and test outcomes in your handoff report.
