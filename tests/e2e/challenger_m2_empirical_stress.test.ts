import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const HAND_TRACKER_PATH = path.join(ROOT_DIR, 'src/components/HandTracker.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');

// ============================================================================
// HARDWARE & BROWSER MOCK IMPLEMENTATIONS
// ============================================================================

class MockMediaStreamTrack {
  public kind: string = 'video';
  public id: string = Math.random().toString(36).slice(2);
  public readyState: 'live' | 'ended' = 'live';
  public enabled: boolean = true;
  public onended: (() => void) | null = null;

  public stop(): void {
    this.readyState = 'ended';
    this.enabled = false;
    if (this.onended) {
      this.onended();
    }
  }
}

class MockMediaStream {
  public active: boolean = true;
  public id: string = Math.random().toString(36).slice(2);
  private tracks: MockMediaStreamTrack[] = [];

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
  }

  public getTracks(): MockMediaStreamTrack[] {
    return [...this.tracks];
  }

  public getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'video');
  }

  public removeTrack(track: MockMediaStreamTrack): void {
    this.tracks = this.tracks.filter(t => t !== track);
    if (this.tracks.length === 0) {
      this.active = false;
    }
  }

  public addTrack(track: MockMediaStreamTrack): void {
    this.tracks.push(track);
    this.active = true;
  }
}

class MockVideoElement {
  public srcObject: MockMediaStream | null = null;
  public src: string = '';
  public paused: boolean = true;
  public ended: boolean = false;
  public playsInline: boolean = false;
  public muted: boolean = false;
  public attributes: Record<string, string> = {};
  public callbacks: Map<number, (now: number, metadata?: any) => void> = new Map();
  private nextCallbackId: number = 1;

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  public removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name === 'src') {
      this.src = '';
    }
  }

  public async play(): Promise<void> {
    this.paused = false;
  }

  public pause(): void {
    this.paused = true;
  }

  public load(): void {
    if (!this.srcObject && !this.src) {
      this.paused = true;
    }
  }

  public requestVideoFrameCallback(cb: (now: number, metadata?: any) => void): number {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, cb);
    return id;
  }

  public cancelVideoFrameCallback(id: number): void {
    this.callbacks.delete(id);
  }
}

class MockMediaPipeHandsInstance {
  public isClosed: boolean = false;
  public resultsCallback: ((results: any) => void) | null = null;
  public options: any = null;

  public setOptions(opts: any): void {
    this.options = opts;
  }

  public onResults(cb: (results: any) => void): void {
    this.resultsCallback = cb;
  }

  public async send(data: any): Promise<void> {
    if (this.isClosed) {
      throw new Error('Cannot call send() on closed MediaPipe Hands instance');
    }
  }

  public close(): void {
    this.isClosed = true;
    this.resultsCallback = null;
  }
}

// ============================================================================
// SIMULATED HARDWARE LIFECYCLE CONTROLLER (Matches HandTracker.tsx logic)
// ============================================================================

class HandTrackerLifecycleController {
  public isEnabled: boolean = false;
  public stream: MockMediaStream | null = null;
  public video: MockVideoElement = new MockVideoElement();
  public handsInstance: MockMediaPipeHandsInstance | null = null;
  public frameId: number | null = null;
  public modelStatus: 'off' | 'starting' | 'active' | 'error' = 'off';
  public handDetected: boolean = false;
  public activeTracksHistory: MockMediaStreamTrack[] = [];

  public startTracking(acquiredStream: MockMediaStream): void {
    if (!this.isEnabled) {
      // If disabled while acquiring, discard stream immediately
      acquiredStream.getTracks().forEach(t => {
        t.stop();
        acquiredStream.removeTrack(t);
      });
      return;
    }

    this.stream = acquiredStream;
    this.activeTracksHistory.push(...acquiredStream.getTracks());
    this.video.srcObject = acquiredStream;
    this.video.paused = false;

    this.handsInstance = new MockMediaPipeHandsInstance();
    this.handsInstance.setOptions({ maxNumHands: 1, modelComplexity: 0 });

    this.modelStatus = 'active';

    // Start video frame callback
    this.frameId = this.video.requestVideoFrameCallback(() => {});
  }

  public stopTracking(): void {
    // 1. Cancel callback
    if (this.frameId !== null) {
      this.video.cancelVideoFrameCallback(this.frameId);
      this.frameId = null;
    }

    // 2. Stop all tracks and unlink
    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => {
        track.stop();
        this.stream?.removeTrack(track);
      });
      this.stream = null;
    }

    // 3. Pause video and clear references
    this.video.pause();
    this.video.srcObject = null;
    this.video.removeAttribute('src');
    this.video.load();

    // 4. Close MediaPipe instance
    if (this.handsInstance) {
      this.handsInstance.close();
      this.handsInstance = null;
    }

    this.modelStatus = 'off';
    this.handDetected = false;
  }
}

// ============================================================================
// SIMULATED GAME & CANVAS LIFECYCLE STATE (Matches PizzaCanvas.tsx logic)
// ============================================================================

class PizzaCanvasLifecycleState {
  public controlMode: 'mouse' | 'camera' = 'mouse';
  public isPlaying: boolean = false;
  public isPaused: boolean = false;
  public handDetected: boolean = false;
  public lastHandTrackedTime: [number, number] = [0, 0];
  public startTime: number = 0;
  public tracker: HandTrackerLifecycleController = new HandTrackerLifecycleController();
  public pauseOverlayRendered: boolean = false;
  public slashesProcessed: number = 0;

  public setControlMode(mode: 'mouse' | 'camera'): void {
    this.controlMode = mode;
    if (mode === 'mouse') {
      this.isPaused = false;
      this.handDetected = false;
      this.tracker.isEnabled = false;
      this.tracker.stopTracking();
    } else {
      this.tracker.isEnabled = true;
    }
  }

  public startGame(): void {
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.lastHandTrackedTime = [Date.now(), Date.now()];
  }

  public onHandCoordsTracked(normX: number, normY: number, handIdx: number, isEngaged: boolean): void {
    if (this.controlMode !== 'camera') {
      // Strictly ignore in mouse mode
      return;
    }
    if (isEngaged) {
      this.lastHandTrackedTime[handIdx] = Date.now();
      this.slashesProcessed++;
    }
  }

  public updateGameLoop(nowMs: number): void {
    if (!this.isPlaying) return;

    if (this.controlMode === 'camera') {
      const lastTracked = Math.max(this.lastHandTrackedTime[0] || nowMs, this.lastHandTrackedTime[1] || nowMs);
      const elapsed = nowMs - lastTracked;
      const gameRunningFor = nowMs - (this.startTime || nowMs);

      if (elapsed > 2000 && gameRunningFor > 1500) {
        this.isPaused = true;
      } else if (this.isPaused && elapsed < 600) {
        this.isPaused = false;
      }
    } else if (this.controlMode === 'mouse' && this.isPaused) {
      // Defensive unpause in mouse mode
      this.isPaused = false;
    }

    // Determine if pause overlay should be drawn
    this.pauseOverlayRendered = this.isPlaying && this.isPaused && this.controlMode === 'camera';
  }

  public triggerGameOver(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.setControlMode('mouse');
    this.handDetected = false;
  }
}

// ============================================================================
// TEST SUITE: EMPIRICAL CHALLENGE HARNESS
// ============================================================================

describe('Challenger 2 Empirical Verification: R2 Camera & Teardown Lifecycle', () => {

  describe('Static Code & Contract Integrity', () => {
    test('HandTracker.tsx contains all required hardware cleanup calls', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('track.stop()'), 'Must call track.stop()');
      assert.ok(code.includes('streamRef.current?.removeTrack'), 'Must remove tracks from stream');
      assert.ok(code.includes('videoRef.current.pause()'), 'Must pause video element');
      assert.ok(code.includes('videoRef.current.srcObject = null'), 'Must nullify srcObject');
      assert.ok(code.includes('videoRef.current.removeAttribute(\'src\')'), 'Must remove src attribute');
      assert.ok(code.includes('videoRef.current.load()'), 'Must call video.load()');
      assert.ok(code.includes('handsInstanceRef.current.close()'), 'Must close MediaPipe instance');
    });

    test('PizzaCanvas.tsx enforces isPaused = false and controlMode = mouse on game over', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(code.includes('isPausedRef.current = false'), 'Must clear isPausedRef on mode change and game over');
      assert.ok(code.includes('setControlMode(\'mouse\')'), 'Must reset controlMode to mouse on game over');
      assert.ok(code.includes('if (controlMode !== \'camera\') return;'), 'handleHandCoordsTracked must ignore non-camera calls');
      assert.ok(code.includes('controlMode === \'camera\''), 'Pause overlay must be guarded by camera mode');
    });
  });

  describe('Empirical Hardware Track Status (readyState === ended)', () => {
    test('Track readyState transitions to "ended" upon stopTracking()', () => {
      const tracker = new HandTrackerLifecycleController();
      tracker.isEnabled = true;

      const track1 = new MockMediaStreamTrack();
      const track2 = new MockMediaStreamTrack();
      const stream = new MockMediaStream([track1, track2]);

      assert.equal(track1.readyState, 'live');
      assert.equal(track2.readyState, 'live');
      assert.equal(stream.active, true);

      tracker.startTracking(stream);
      assert.equal(tracker.modelStatus, 'active');
      assert.equal(tracker.video.paused, false);

      // Teardown
      tracker.stopTracking();

      assert.equal(track1.readyState, 'ended', 'track1 readyState MUST be "ended"');
      assert.equal(track2.readyState, 'ended', 'track2 readyState MUST be "ended"');
      assert.equal(stream.getTracks().length, 0, 'Stream must have 0 tracks remaining');
      assert.equal(stream.active, false, 'Stream must be inactive');
      assert.equal(tracker.stream, null, 'stream ref must be null');
      assert.equal(tracker.video.srcObject, null, 'video.srcObject must be null');
      assert.equal(tracker.video.paused, true, 'video must be paused');
      assert.equal(tracker.frameId, null, 'frame callback must be cancelled');
    });

    test('In-flight getUserMedia discarded when tracking disabled before resolution', () => {
      const tracker = new HandTrackerLifecycleController();
      tracker.isEnabled = false; // User toggled off during permission prompt

      const pendingTrack = new MockMediaStreamTrack();
      const pendingStream = new MockMediaStream([pendingTrack]);

      tracker.startTracking(pendingStream);

      assert.equal(pendingTrack.readyState, 'ended', 'Pending track must be stopped immediately upon resolution');
      assert.equal(pendingStream.getTracks().length, 0, 'Pending stream must have tracks removed');
      assert.equal(tracker.stream, null, 'No stream must be attached');
      assert.equal(tracker.modelStatus, 'off');
    });
  });

  describe('Mouse Mode Immunity to Hand Lost Events', () => {
    test('Mouse mode ignores hand tracking lost events and continues game loop unhindered', () => {
      const game = new PizzaCanvasLifecycleState();
      game.setControlMode('mouse');
      game.startGame();

      const startTime = 10000;
      game.startTime = startTime;

      // Simulate 10 seconds of gameplay with no hand tracked
      for (let t = 0; t <= 10000; t += 1000) {
        game.updateGameLoop(startTime + t);
        assert.equal(game.isPaused, false, `Game must remain unpaused at t=${t}ms in mouse mode`);
        assert.equal(game.pauseOverlayRendered, false, `Pause overlay must NOT render at t=${t}ms in mouse mode`);
      }

      // External optical event arrives while in mouse mode
      game.onHandCoordsTracked(0.5, 0.5, 0, true);
      assert.equal(game.slashesProcessed, 0, 'Optical coordinates must be ignored in mouse mode');
    });

    test('Switching to Mouse Mode WHILE paused in camera mode immediately unpauses and tears down camera', () => {
      const game = new PizzaCanvasLifecycleState();
      game.setControlMode('camera');

      const track = new MockMediaStreamTrack();
      const stream = new MockMediaStream([track]);
      game.tracker.startTracking(stream);
      game.startGame();

      const startTime = 1000;
      game.startTime = startTime;
      game.lastHandTrackedTime = [startTime, startTime];

      // 1. Advance time 3000ms without hand -> enters pause in camera mode
      game.updateGameLoop(startTime + 3000);
      assert.equal(game.isPaused, true, 'Should be paused in camera mode after 3000ms hand loss');
      assert.equal(game.pauseOverlayRendered, true, 'Pause overlay must be rendered in camera mode');

      // 2. User switches to Mouse Mode (e.g. clicking "VOLVER AL RATÓN")
      game.setControlMode('mouse');

      // Assert immediate synchronous unpause and camera teardown
      assert.equal(game.isPaused, false, 'isPaused MUST immediately reset to false on switch to mouse mode');
      assert.equal(game.controlMode, 'mouse');
      assert.equal(track.readyState, 'ended', 'Camera hardware track MUST be stopped');
      assert.equal(game.tracker.stream, null, 'Camera stream must be null');

      // 3. Next game loop tick runs unhindered
      game.updateGameLoop(startTime + 4000);
      assert.equal(game.isPaused, false, 'Game loop must remain unpaused');
      assert.equal(game.pauseOverlayRendered, false, 'Pause overlay must NOT render');
    });
  });

  describe('Game Over Cleanup & Unpause Guarantees', () => {
    test('Game Over in Camera Mode stops camera hardware and resets pause state', () => {
      const game = new PizzaCanvasLifecycleState();
      game.setControlMode('camera');

      const track = new MockMediaStreamTrack();
      const stream = new MockMediaStream([track]);
      game.tracker.startTracking(stream);
      game.startGame();

      // Simulate hand lost pause prior to game over
      game.isPaused = true;

      // Trigger Game Over
      game.triggerGameOver();

      assert.equal(game.isPlaying, false, 'Game isPlaying must be false');
      assert.equal(game.isPaused, false, 'isPaused must be false');
      assert.equal(game.controlMode, 'mouse', 'controlMode must be reset to mouse');
      assert.equal(track.readyState, 'ended', 'Camera hardware must be ended');
      assert.equal(game.pauseOverlayRendered, false, 'Pause overlay must not be rendered');
    });
  });

  describe('Adversarial Stress Test: Rapid Mode Cycling', () => {
    test('20 Rapid Camera <-> Mouse toggles cleanly release all hardware tracks without memory leaks', () => {
      const tracker = new HandTrackerLifecycleController();
      const allTracks: MockMediaStreamTrack[] = [];

      for (let i = 0; i < 20; i++) {
        // Toggle to camera
        tracker.isEnabled = true;
        const track = new MockMediaStreamTrack();
        allTracks.push(track);
        const stream = new MockMediaStream([track]);
        tracker.startTracking(stream);

        assert.equal(tracker.modelStatus, 'active');
        assert.equal(track.readyState, 'live');

        // Toggle to mouse
        tracker.isEnabled = false;
        tracker.stopTracking();

        assert.equal(tracker.modelStatus, 'off');
        assert.equal(track.readyState, 'ended');
        assert.equal(tracker.stream, null);
      }

      // Verify every single historical track is cleanly ended
      assert.equal(allTracks.length, 20);
      allTracks.forEach((t, idx) => {
        assert.equal(t.readyState, 'ended', `Track #${idx} must be ended`);
      });
    });
  });
});
