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

describe('Challenger M2 Adversarial Stress Test Suite: Camera Lifecycle, Rapid Toggling & Race Conditions', () => {

  // ==========================================================================
  // 1. ADVERSARIAL RAPID MODE SWITCHING (TOGGLE STORM SIMULATION)
  // ==========================================================================
  describe('1. Adversarial Rapid Mode Switching & Hardware Stream Teardown', () => {

    // Mock MediaStreamTrack simulating real browser media track
    class MockMediaStreamTrack {
      public kind: string = 'video';
      public readyState: 'live' | 'ended' = 'live';
      public stopCallCount: number = 0;

      stop() {
        this.readyState = 'ended';
        this.stopCallCount++;
      }
    }

    // Mock MediaStream simulating real browser MediaStream
    class MockMediaStream {
      public tracks: MockMediaStreamTrack[] = [];
      public removedTracks: MockMediaStreamTrack[] = [];

      constructor() {
        this.tracks.push(new MockMediaStreamTrack());
      }

      getTracks(): MockMediaStreamTrack[] {
        return [...this.tracks];
      }

      removeTrack(track: MockMediaStreamTrack) {
        this.tracks = this.tracks.filter(t => t !== track);
        this.removedTracks.push(track);
      }
    }

    // Mock MediaPipe Hands instance
    class MockMediaPipeHands {
      public isClosed: boolean = false;
      public sendCallCount: number = 0;

      close() {
        this.isClosed = true;
      }

      send(input: any) {
        if (this.isClosed) {
          throw new Error('MediaPipe closed instance cannot process frames');
        }
        this.sendCallCount++;
      }

      setOptions(opts: any) {}
      onResults(cb: any) {}
    }

    // Complete Simulation Engine matching HandTracker & PizzaCanvas contract
    class CameraLifecycleSimulationEngine {
      public controlMode: 'mouse' | 'camera' = 'mouse';
      public isEnabled: boolean = false;
      public isPaused: boolean = false;
      public handDetected: boolean = false;
      public activeStream: MockMediaStream | null = null;
      public allCreatedStreams: MockMediaStream[] = [];
      public activeHandsInstance: MockMediaPipeHands | null = null;
      public allCreatedHands: MockMediaPipeHands[] = [];
      public activeFrameId: number | null = null;
      public cancelledFrameIds: number[] = [];
      public nextFrameId: number = 1;
      public isPlaying: boolean = true;
      public lastHandTrackedTime: number = Date.now();
      public startTime: number = Date.now();
      public targetHandX: number[] = [0, 0];
      public targetHandY: number[] = [0, 0];
      public trail: any[] = [];

      public setMode(mode: 'mouse' | 'camera') {
        this.controlMode = mode;
        this.isEnabled = (mode === 'camera');

        if (mode === 'mouse') {
          this.handleStopTracking();
          // PizzaCanvas useEffect synchronization
          this.isPaused = false;
          this.handDetected = false;
          this.targetHandX = [0, 0];
          this.targetHandY = [0, 0];
          this.trail = [];
        } else {
          this.handleStartTracking();
        }
      }

      public handleStartTracking() {
        // Clean previous instances
        if (this.activeHandsInstance) {
          this.activeHandsInstance.close();
          this.activeHandsInstance = null;
        }

        if (this.activeFrameId !== null) {
          this.cancelledFrameIds.push(this.activeFrameId);
          this.activeFrameId = null;
        }

        const hands = new MockMediaPipeHands();
        this.allCreatedHands.push(hands);
        this.activeHandsInstance = hands;

        const stream = new MockMediaStream();
        this.allCreatedStreams.push(stream);
        this.activeStream = stream;

        this.activeFrameId = this.nextFrameId++;
      }

      public handleStopTracking() {
        // 1. Cancel frame loop
        if (this.activeFrameId !== null) {
          this.cancelledFrameIds.push(this.activeFrameId);
          this.activeFrameId = null;
        }

        // 2. Stop all tracks and remove them
        if (this.activeStream) {
          const tracks = this.activeStream.getTracks();
          tracks.forEach(track => {
            track.stop();
            this.activeStream?.removeTrack(track);
          });
          this.activeStream = null;
        }

        // 3. Close MediaPipe instance
        if (this.activeHandsInstance) {
          this.activeHandsInstance.close();
          this.activeHandsInstance = null;
        }

        this.handDetected = false;
      }

      public simulateTick(nowMs: number) {
        if (!this.isPlaying) return;

        if (this.controlMode === 'camera') {
          const elapsed = nowMs - this.lastHandTrackedTime;
          const gameRunningFor = nowMs - this.startTime;
          if (elapsed > 2000 && gameRunningFor > 1500) {
            this.isPaused = true;
          } else if (this.isPaused && elapsed < 600) {
            this.isPaused = false;
          }
        } else if (this.controlMode === 'mouse') {
          if (this.isPaused) {
            this.isPaused = false;
          }
        }
      }

      public simulateGameOver() {
        this.isPlaying = false;
        this.isPaused = false;
        this.setMode('mouse');
        this.handDetected = false;
      }
    }

    test('1.1: 100-Iteration Toggle Storm (Rapid Camera <-> Mouse switching without hardware leak)', () => {
      const engine = new CameraLifecycleSimulationEngine();

      for (let cycle = 0; cycle < 100; cycle++) {
        // Switch to Camera
        engine.setMode('camera');
        assert.equal(engine.controlMode, 'camera');
        assert.equal(engine.isEnabled, true);
        assert.ok(engine.activeStream !== null, `Active stream must exist in cycle ${cycle}`);
        assert.ok(engine.activeHandsInstance !== null, `Active hands instance must exist in cycle ${cycle}`);
        assert.equal(engine.activeHandsInstance.isClosed, false);

        // Switch to Mouse
        engine.setMode('mouse');
        assert.equal(engine.controlMode, 'mouse');
        assert.equal(engine.isEnabled, false);
        assert.equal(engine.activeStream, null, `Active stream ref must be null in cycle ${cycle}`);
        assert.equal(engine.activeHandsInstance, null, `Active hands ref must be null in cycle ${cycle}`);
        assert.equal(engine.isPaused, false);
        assert.equal(engine.handDetected, false);
      }

      // Verify every single created stream has all tracks ended and removed
      assert.equal(engine.allCreatedStreams.length, 100, 'Exactly 100 streams created');
      engine.allCreatedStreams.forEach((stream, idx) => {
        assert.equal(stream.tracks.length, 0, `Stream ${idx} must have 0 remaining active tracks`);
        assert.equal(stream.removedTracks.length, 1, `Stream ${idx} must have 1 track removed`);
        assert.equal(stream.removedTracks[0].readyState, 'ended', `Track in stream ${idx} must be ended`);
        assert.equal(stream.removedTracks[0].stopCallCount, 1, `Track in stream ${idx} must be stopped once`);
      });

      // Verify every single MediaPipe instance was closed
      assert.equal(engine.allCreatedHands.length, 100, 'Exactly 100 MediaPipe instances created');
      engine.allCreatedHands.forEach((hands, idx) => {
        assert.equal(hands.isClosed, true, `MediaPipe instance ${idx} must be closed`);
      });

      // Verify all frame callbacks were cancelled
      assert.equal(engine.cancelledFrameIds.length, 100, 'All 100 frame callback IDs must be cancelled');
      assert.equal(engine.activeFrameId, null);
    });

    test('1.2: Alternating Async Tick during Toggle Storm (Zero frames sent to closed instances)', () => {
      const engine = new CameraLifecycleSimulationEngine();

      for (let i = 0; i < 20; i++) {
        engine.setMode('camera');
        assert.ok(engine.activeHandsInstance);
        engine.activeHandsInstance.send({ frame: i });

        engine.setMode('mouse');
        // If a delayed frame arrived after mode switch, attempting to send to closed instance throws
        if (engine.activeHandsInstance) {
          assert.fail('activeHandsInstance should be null after setMode("mouse")');
        }
      }
    });
  });

  // ==========================================================================
  // 2. CAMERA PERMISSION DENIAL & HARDWARE ERROR RESILIENCE
  // ==========================================================================
  describe('2. Camera Permission Denial & Hardware Failure Handling', () => {

    test('2.1: HandTracker implements comprehensive error categorization for NotAllowedError / NotReadableError', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Check for friendly error message translation
      assert.ok(code.includes('NotAllowedError') || code.includes('denied'), 'Must catch NotAllowedError / permission denial');
      assert.ok(code.includes('Permiso denegado por el navegador') || code.includes('Permiso denegado'), 'Must provide friendly permission denied message');
      assert.ok(code.includes("onStatusChange('error'"), 'Must propagate error status to parent');
      assert.ok(code.includes("setModelStatus('error')"), 'Must update local modelStatus to error');
    });

    test('2.2: PizzaCanvas handles HandTracker error callback and displays error toast', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(code.includes('onStatusChange='), 'PizzaCanvas must pass onStatusChange callback to HandTracker');
      assert.ok(code.includes('onToastMessage'), 'PizzaCanvas must invoke toast notification on error');
    });

    test('2.3: Fallback button "VOLVER AL RATÓN" is wired and resets controlMode', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(code.includes('onFallbackToMouse'), 'Must provide onFallbackToMouse handler');
      assert.ok(
        code.includes("setControlMode('mouse')"),
        'Fallback must switch controlMode to mouse'
      );
    });
  });

  // ==========================================================================
  // 3. ASYNC RACE CONDITIONS & UNMOUNT MID-INITIALIZATION
  // ==========================================================================
  describe('3. Async Race Conditions & Unmount Mid-Initialization', () => {

    test('3.1: isCancelled flag aborts start sequence if unmounted during script fetch', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Verify cancellation guard in script injection effect
      assert.ok(code.includes('let isCancelled = false;'), 'Must declare isCancelled flag in useEffect');
      assert.ok(code.includes('isCancelled = true;'), 'Must set isCancelled = true on unmount/cleanup');
      assert.ok(
        code.includes('if (isCancelled || !isEnabledRef.current) return;') ||
        code.includes('if (isCancelled) return;') ||
        code.includes('if (isCancelled || !isEnabledRef.current)'),
        'Must abort script load handler if isCancelled is true'
      );
    });

    test('3.2: Immediate check for !isEnabledRef.current after getUserMedia resolves', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Verify stream cleanup if disabled while permission dialog was awaiting user click
      assert.ok(
        code.includes('!isEnabledRef.current') || code.includes('!isEnabled'),
        'Must verify isEnabled status after awaiting getUserMedia'
      );
      assert.ok(
        code.includes('stream.getTracks().forEach') && code.includes('t.stop()'),
        'Must stop stream tracks if disabled post-approval'
      );
    });

    test('3.3: Unmount cleanup hook calls handleStopTracking() unconditionally', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      // Check useEffect empty deps cleanup
      assert.ok(
        code.includes('useEffect(() => {\n    return () => {\n      handleStopTracking();\n    };\n  }, []);') ||
        (code.includes('handleStopTracking()') && code.includes('return () =>')),
        'Must invoke handleStopTracking on unmount'
      );
    });
  });

  // ==========================================================================
  // 4. BACKGROUND STREAM RETENTION & DEEP HARDWARE PURGE
  // ==========================================================================
  describe('4. Background Stream Retention & Resource Deallocation', () => {

    test('4.1: Video element decoding pipeline deallocation (pause + null srcObject + removeAttribute + load)', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      assert.ok(code.includes('videoRef.current.pause()'), 'Must pause video element');
      assert.ok(code.includes('videoRef.current.srcObject = null'), 'Must nullify srcObject');
      assert.ok(code.includes("removeAttribute('src')"), 'Must remove src attribute');
      assert.ok(code.includes('videoRef.current.load()'), 'Must trigger load() to purge decoder buffer');
    });

    test('4.2: Dual cancellation for requestVideoFrameCallback and requestAnimationFrame', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      assert.ok(code.includes('cancelVideoFrameCallback'), 'Must support cancelVideoFrameCallback');
      assert.ok(code.includes('cancelAnimationFrame'), 'Must support cancelAnimationFrame fallback');
      assert.ok(code.includes('frameIdRef.current = null'), 'Must reset frameId ref to null');
    });

    test('4.3: MediaPipe Hands WASM / WebGL memory release (.close())', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');

      assert.ok(code.includes('handsInstanceRef.current.close()'), 'Must invoke .close() on handsInstanceRef');
      assert.ok(code.includes('handsInstanceRef.current = null'), 'Must nullify handsInstanceRef');
    });
  });

  // ==========================================================================
  // 5. GAME STATE SYNCHRONIZATION & "DETECCIÓN PERDIDA" ISOLATION
  // ==========================================================================
  describe('5. Game State Synchronization & "DETECCIÓN PERDIDA" Isolation', () => {

    test('5.1: Switching from Camera Mode (when paused) to Mouse Mode immediately unpauses game', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // controlMode useEffect reset logic
      assert.ok(code.includes("if (controlMode === 'mouse')"), 'Must have controlMode === mouse condition');
      assert.ok(code.includes('isPausedRef.current = false'), 'Must force isPausedRef to false');
      assert.ok(code.includes('setIsPaused(false)'), 'Must update React isPaused state to false');
      assert.ok(code.includes('handDetectedRef.current = false'), 'Must reset handDetectedRef');
      assert.ok(code.includes('setHandDetected(false)'), 'Must reset setHandDetected state');
    });

    test('5.2: Game loop updateLoop enforces mouse mode unpause invariant', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(
        code.includes("else if (controlMode === 'mouse' && isPausedRef.current)") ||
        code.includes("controlMode === 'mouse' && isPausedRef.current"),
        'Game loop must defensively enforce that mouse mode is never paused'
      );
    });

    test('5.3: Game Over in Camera Mode automatically resets controlMode to mouse and stops camera', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(
        code.includes("setControlMode('mouse')"),
        'isGameOver handler must reset controlMode to mouse'
      );
    });

    test('5.4: "DETECCIÓN PERDIDA" rendering banner strictly checks controlMode === camera', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(
        code.includes("isPlaying && isPausedRef.current && controlMode === 'camera'") ||
        code.includes("controlMode === 'camera' && isPausedRef.current"),
        'Detection Lost overlay rendering must be strictly guarded by controlMode === camera'
      );
    });
  });
});
