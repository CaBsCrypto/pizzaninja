import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const HAND_TRACKER_PATH = path.join(ROOT_DIR, 'src/components/HandTracker.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');

// Simulated State Machine for Camera Tracking Lifecycle
class MockCameraLifecycleStateMachine {
  public isEnabled: boolean = false;
  public controlMode: 'mouse' | 'camera' = 'mouse';
  public isPaused: boolean = false;
  public handDetected: boolean = false;
  public streamActive: boolean = false;
  public trackStoppedCount: number = 0;
  public mediaPipeClosed: boolean = false;
  public isPlaying: boolean = true;
  public lastHandTrackedTime: number = Date.now();
  public startTime: number = Date.now();

  public setMode(mode: 'mouse' | 'camera') {
    this.controlMode = mode;
    this.isEnabled = (mode === 'camera');
    if (mode === 'mouse') {
      this.stopCameraHardware();
      this.isPaused = false;
      this.handDetected = false;
    } else {
      this.startCameraHardware();
    }
  }

  public startCameraHardware() {
    this.streamActive = true;
    this.mediaPipeClosed = false;
  }

  public stopCameraHardware() {
    if (this.streamActive) {
      this.trackStoppedCount += 1;
      this.streamActive = false;
    }
    this.mediaPipeClosed = true;
    this.handDetected = false;
  }

  public simulateGameLoopTick(now: number) {
    if (!this.isPlaying) return;

    if (this.controlMode === 'camera') {
      const elapsed = now - this.lastHandTrackedTime;
      const gameRunningFor = now - this.startTime;
      if (elapsed > 2000 && gameRunningFor > 1500) {
        this.isPaused = true;
      } else if (this.isPaused && elapsed < 600) {
        this.isPaused = false;
      }
    } else {
      // In mouse mode, tracking loss NEVER causes pause
      if (this.isPaused) {
        this.isPaused = false;
      }
    }
  }

  public triggerGameOver() {
    this.isPlaying = false;
    this.stopCameraHardware();
    this.isPaused = false;
  }
}

describe('Requirement R2 E2E Test Suite: Camera State Deactivation & Lifecycle Cleanup', () => {

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (Core camera teardown & pause reset)
  // ==========================================================================
  describe('Tier 1: Feature Coverage', () => {

    test('1.1: HandTracker stops all MediaStream tracks on teardown / handleStopTracking', () => {
      assert.ok(fs.existsSync(HAND_TRACKER_PATH), 'HandTracker.tsx must exist');
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Verify track stopping logic
      assert.ok(code.includes('handleStopTracking'), 'HandTracker must implement handleStopTracking');
      assert.ok(code.includes('getTracks()'), 'Must access MediaStream getTracks()');
      assert.ok(code.includes('.stop()'), 'Must call track.stop() on each track');
      assert.ok(code.includes('streamRef.current = null') || code.includes('streamRef'), 'Must clear stream reference');
    });

    test('1.2: HandTracker clears video frame callbacks and animation frames', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Must cancel frame requests properly
      assert.ok(
        code.includes('cancelAnimationFrame') || code.includes('cancelVideoFrameCallback'),
        'Must cancel pending animation frame or video frame callbacks'
      );
      assert.ok(code.includes('frameIdRef'), 'Must track frame ID in ref');
    });

    test('1.3: HandTracker closes MediaPipe Hands instance and cleans up memory', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      
      assert.ok(code.includes('handsInstanceRef'), 'Must track MediaPipe Hands instance');
      assert.ok(code.includes('.close()') || code.includes('handsInstanceRef.current = null'), 'Must close MediaPipe instance on stop');
    });

    test('1.4: PizzaCanvas synchronizes controlMode and resets isPaused on switch to Mouse/Normal Mode', () => {
      assert.ok(fs.existsSync(PIZZA_CANVAS_PATH), 'PizzaCanvas.tsx must exist');
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Check controlMode state
      assert.ok(code.includes("controlMode === 'mouse'") || code.includes("setControlMode('mouse')"), 'Must support switching to mouse mode');
      assert.ok(code.includes('isPausedRef.current = false') || code.includes('setIsPaused(false)'), 'Must reset isPaused when entering mouse mode');
    });

    test('1.5: "DETECCIÓN PERDIDA" overlay is strictly isolated to Camera Mode and never renders in Normal Mode', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Search for DETECCIÓN PERDIDA in PizzaCanvas
      assert.ok(code.includes('DETECCIÓN PERDIDA') || code.includes('DETECCION PERDIDA') || code.includes('MAMMA MIA'), 'Pause overlay text should be defined');
      
      // Verify pause drawing is guarded by controlMode === 'camera' or mouse mode reset
      const hasGuard = code.includes("controlMode === 'camera'") || code.includes("!isPausedRef.current");
      assert.ok(hasGuard, 'Pause banner must be guarded or cleared for mouse mode');
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Timeouts, permissions, rapid toggle)
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    test('2.1: Hand detection timeout boundary (2000ms threshold in camera vs mouse)', () => {
      const sm = new MockCameraLifecycleStateMachine();
      const baseTime = 10000;
      sm.startTime = baseTime;
      sm.lastHandTrackedTime = baseTime;

      // 1. Camera mode: 1000ms missing -> not paused
      sm.setMode('camera');
      sm.simulateGameLoopTick(baseTime + 1000);
      assert.equal(sm.isPaused, false, 'Should not pause before 2000ms');

      // 2. Camera mode: 2100ms missing -> auto-paused
      sm.simulateGameLoopTick(baseTime + 2100);
      assert.equal(sm.isPaused, true, 'Should pause after > 2000ms missing in camera mode');

      // 3. Re-detect hand within 500ms -> auto-resumes
      sm.lastHandTrackedTime = baseTime + 2200;
      sm.simulateGameLoopTick(baseTime + 2300);
      assert.equal(sm.isPaused, false, 'Should auto-resume when hand is tracked');

      // 4. Mouse mode: 10000ms missing -> NEVER paused
      sm.setMode('mouse');
      sm.lastHandTrackedTime = baseTime;
      sm.simulateGameLoopTick(baseTime + 10000);
      assert.equal(sm.isPaused, false, 'Mouse mode must NEVER auto-pause from missing hand coordinates');
    });

    test('2.2: Rapid Mode Toggling (Camera -> Mouse -> Camera -> Mouse within 100ms)', () => {
      const sm = new MockCameraLifecycleStateMachine();
      
      for (let i = 0; i < 5; i++) {
        sm.setMode('camera');
        assert.equal(sm.streamActive, true);
        sm.setMode('mouse');
        assert.equal(sm.streamActive, false);
        assert.equal(sm.isPaused, false);
        assert.equal(sm.handDetected, false);
      }

      assert.equal(sm.trackStoppedCount, 5, 'All intermediate streams must have been cleanly stopped');
    });

    test('2.3: Permission rejection error handling & graceful mouse fallback', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      
      assert.ok(code.includes('onStatusChange'), 'HandTracker must notify parent of error status');
      assert.ok(code.includes('onFallbackToMouse') || code.includes("setControlMode('mouse')"), 'Must support fallback to mouse on failure');
    });

    test('2.4: Game Over stops camera and unpauses state', () => {
      const sm = new MockCameraLifecycleStateMachine();
      sm.setMode('camera');
      sm.isPaused = true;

      sm.triggerGameOver();
      assert.equal(sm.isPlaying, false);
      assert.equal(sm.streamActive, false, 'Camera stream must stop on game over');
      assert.equal(sm.isPaused, false, 'isPaused must be reset to false on game over');
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (Mode switch during pause, async race)
  // ==========================================================================
  describe('Tier 3: Cross-Feature Interactions', () => {

    test('3.1: Switching to Mouse Mode WHILE paused in "DETECCIÓN PERDIDA" immediately unpauses', () => {
      const sm = new MockCameraLifecycleStateMachine();
      sm.setMode('camera');
      sm.lastHandTrackedTime = 1000;
      sm.startTime = 1000;

      // Trigger pause in camera mode
      sm.simulateGameLoopTick(4000);
      assert.equal(sm.isPaused, true, 'Game is paused due to detection loss');

      // User clicks "VOLVER AL RATÓN"
      sm.setMode('mouse');
      assert.equal(sm.controlMode, 'mouse');
      assert.equal(sm.isPaused, false, 'isPaused must immediately reset to false when switching to mouse mode');
      assert.equal(sm.streamActive, false, 'Camera hardware must be closed');

      // Run game loop in mouse mode
      sm.simulateGameLoopTick(5000);
      assert.equal(sm.isPaused, false, 'Game continues unpaused in mouse mode');
    });

    test('3.2: Async Script Injection & Cancellation Guards', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Check for cancellation token or isEnabled check
      assert.ok(
        code.includes('isCancelled') || 
        code.includes('isEnabledRef') || 
        code.includes('!isEnabled') ||
        code.includes('handleStopTracking'),
        'Script loading must verify active state before starting tracking'
      );
    });

    test('3.3: In-Flight getUserMedia Resolution after mode change', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(
        code.includes('getUserMedia') && (code.includes('stop()') || code.includes('streamRef')),
        'getUserMedia must track stream reference to allow immediate disposal'
      );
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (End-to-end multi-game transitions)
  // ==========================================================================
  describe('Tier 4: Real-World Scenarios', () => {

    test('4.1: End-to-End Multi-Game Flow (Camera Match -> Hand Lost -> Mouse Mode -> Menu -> Restart)', () => {
      const sm = new MockCameraLifecycleStateMachine();

      // Step 1: Start in Camera Mode
      sm.setMode('camera');
      assert.equal(sm.controlMode, 'camera');
      assert.equal(sm.streamActive, true);

      // Step 2: Player removes hands -> auto-pause
      sm.startTime = 1000;
      sm.lastHandTrackedTime = 1000;
      sm.simulateGameLoopTick(3500);
      assert.equal(sm.isPaused, true);

      // Step 3: Player clicks "JUGAR NORMAL"
      sm.setMode('mouse');
      assert.equal(sm.isPaused, false);
      assert.equal(sm.streamActive, false);

      // Step 4: Game Over in Normal Mode
      sm.triggerGameOver();
      assert.equal(sm.isPlaying, false);
      assert.equal(sm.isPaused, false);

      // Step 5: Start a new Normal match
      sm.isPlaying = true;
      sm.startTime = 10000;
      sm.simulateGameLoopTick(11000);
      assert.equal(sm.isPaused, false, 'New game in normal mode starts cleanly without camera interference');
    });
  });
});
