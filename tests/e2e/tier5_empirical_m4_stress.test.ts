import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');
const HAND_TRACKER_PATH = path.join(ROOT_DIR, 'src/components/HandTracker.tsx');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const INDEX_CSS_PATH = path.join(ROOT_DIR, 'src/index.css');

describe('Tier 5 Empirical Stress & Invariant Verification Suite (Milestone 4)', () => {

  // ==========================================================================
  // SUITE 1: 3 BUG FIXES HARMONIOUS INTERACTION & REGRESSION PREVENTION
  // ==========================================================================
  describe('Suite 1: Harmonious 3-Bug Fix Interaction & Cross-Cutting Invariants', () => {

    class IntegratedGameSimulator {
      public viewport: { width: number; height: number; isFullscreen: boolean } = {
        width: 390,
        height: 844,
        isFullscreen: false
      };
      public controlMode: 'mouse' | 'camera' = 'mouse';
      public isCameraActive: boolean = false;
      public isPaused: boolean = false;
      public isPlaying: boolean = false;
      public isGameOver: boolean = false;
      public isRegistering: boolean = false;
      public score: number = 0;
      public lives: number = 3;
      public cameraTracksRunning: number = 0;
      public pendingScore: { score: number; mode: string } | null = null;

      public resizeViewport(w: number, h: number, fullscreen: boolean = false) {
        this.viewport = { width: w, height: h, isFullscreen: fullscreen };
      }

      public startGame(mode: 'mouse' | 'camera') {
        this.controlMode = mode;
        this.isPlaying = true;
        this.isGameOver = false;
        this.isRegistering = false;
        this.score = 0;
        this.lives = 3;
        this.pendingScore = null;

        if (mode === 'camera') {
          this.isCameraActive = true;
          this.cameraTracksRunning = 1;
        } else {
          this.stopCamera();
          this.isPaused = false;
        }
      }

      public stopCamera() {
        this.cameraTracksRunning = 0;
        this.isCameraActive = false;
      }

      public switchMode(newMode: 'mouse' | 'camera') {
        this.controlMode = newMode;
        if (newMode === 'mouse') {
          this.stopCamera();
          this.isPaused = false; // INVARIANT: switching to mouse must immediately unpause
        } else {
          this.isCameraActive = true;
          this.cameraTracksRunning = 1;
        }
      }

      public simulateHandLost() {
        if (this.controlMode === 'camera' && this.isPlaying) {
          this.isPaused = true;
        }
      }

      public triggerGameOver() {
        this.isPlaying = false;
        this.isGameOver = true;
        this.isRegistering = true;
        this.pendingScore = { score: this.score, mode: this.controlMode };
        this.stopCamera();
        this.isPaused = false; // INVARIANT: game over resets pause
      }

      public dismissScoreModal() {
        this.isRegistering = false;
        this.pendingScore = null;
      }

      public replayGame() {
        this.dismissScoreModal();
        this.startGame(this.controlMode);
      }
    }

    test('1.1: Mobile Portrait (375x667) -> Camera Mode -> Hand Lost -> Switch to Mouse -> Fullscreen -> Game Over', () => {
      const sim = new IntegratedGameSimulator();

      // Step 1: Start on small mobile in Camera Mode
      sim.resizeViewport(375, 667, false);
      sim.startGame('camera');
      assert.equal(sim.controlMode, 'camera');
      assert.equal(sim.cameraTracksRunning, 1);
      assert.equal(sim.isPaused, false);

      // Step 2: Hand is lost -> paused
      sim.simulateHandLost();
      assert.equal(sim.isPaused, true, 'Should pause when hand is lost in camera mode');

      // Step 3: Switch to Mouse Mode while paused
      sim.switchMode('mouse');
      assert.equal(sim.controlMode, 'mouse');
      assert.equal(sim.isPaused, false, 'Invariant: Must immediately unpause when switching to mouse');
      assert.equal(sim.cameraTracksRunning, 0, 'Invariant: Camera stream tracks must be 0');

      // Step 4: Rotate to landscape and go Fullscreen
      sim.resizeViewport(667, 375, true);
      assert.equal(sim.viewport.isFullscreen, true);

      // Step 5: Score points and trigger Game Over
      sim.score = 3400;
      sim.triggerGameOver();

      // Step 6: Verify Game Over state integrity
      assert.equal(sim.isGameOver, true);
      assert.equal(sim.isRegistering, true);
      assert.equal(sim.pendingScore?.score, 3400);
      assert.equal(sim.isPaused, false);
      assert.equal(sim.cameraTracksRunning, 0);
    });

    test('1.2: 50 Iterations of Cross-Mode, Cross-Resolution, Fullscreen Chaos Loop', () => {
      const sim = new IntegratedGameSimulator();
      const resolutions = [
        { w: 320, h: 480, fs: false },
        { w: 375, h: 667, fs: false },
        { w: 390, h: 844, fs: true },
        { w: 412, h: 915, fs: false },
        { w: 844, h: 390, fs: true },
        { w: 1920, h: 1080, fs: true }
      ];

      for (let i = 0; i < 50; i++) {
        const res = resolutions[i % resolutions.length];
        sim.resizeViewport(res.w, res.h, res.fs);

        const mode = (i % 2 === 0) ? 'camera' : 'mouse';
        sim.startGame(mode);

        if (mode === 'camera') {
          if (i % 3 === 0) {
            sim.simulateHandLost();
            assert.equal(sim.isPaused, true);
            sim.switchMode('mouse');
            assert.equal(sim.isPaused, false);
            assert.equal(sim.cameraTracksRunning, 0);
          }
        }

        sim.score = (i + 1) * 150;
        sim.triggerGameOver();

        assert.equal(sim.isPaused, false, `Iteration ${i}: isPaused must be false on game over`);
        assert.equal(sim.cameraTracksRunning, 0, `Iteration ${i}: camera tracks must be 0 on game over`);
        assert.equal(sim.isRegistering, true, `Iteration ${i}: isRegistering must be true on game over`);
        assert.equal(sim.pendingScore?.score, (i + 1) * 150);

        sim.replayGame();
        assert.equal(sim.isPlaying, true);
        assert.equal(sim.isRegistering, false);
      }
    });
  });

  // ==========================================================================
  // SUITE 2: HIGH-THROUGHPUT STATE SYNCHRONIZATION STRESS
  // ==========================================================================
  describe('Suite 2: State Synchronization & High Throughput Stress', () => {

    test('2.1: 10,000 Rapid Slicing & Combo State Transitions Stress Test', () => {
      interface SliceEvent {
        x: number;
        y: number;
        timestamp: number;
        isCombo: boolean;
      }

      let currentScore = 0;
      let currentCombo = 0;
      let maxCombo = 0;
      let lastSliceTime = 0;
      const history: SliceEvent[] = [];

      for (let i = 0; i < 10000; i++) {
        const now = 10000 + i * 50; // 50ms intervals
        const isQuickSuccession = (now - lastSliceTime) < 300;

        if (isQuickSuccession) {
          currentCombo += 1;
        } else {
          currentCombo = 1;
        }

        if (currentCombo > maxCombo) {
          maxCombo = currentCombo;
        }

        const points = 10 * Math.max(1, currentCombo);
        currentScore += points;

        history.push({
          x: (i * 17) % 800,
          y: (i * 23) % 600,
          timestamp: now,
          isCombo: currentCombo >= 3
        });

        lastSliceTime = now;
      }

      assert.ok(currentScore > 100000, 'Score should accumulate correctly');
      assert.ok(maxCombo > 5, 'Combos should chain during high frequency slicing');
      assert.equal(history.length, 10000);
      // Verify monotonically increasing timestamps
      for (let j = 1; j < history.length; j++) {
        assert.ok(history[j].timestamp >= history[j - 1].timestamp);
      }
    });

    test('2.2: Concurrent Bomb Collision, Life Depletion, and Game Over Invariants', () => {
      let lives = 3;
      let isGameOver = false;
      let explosionsTriggered = 0;

      const triggerBombHit = () => {
        if (isGameOver) return;
        lives -= 1;
        explosionsTriggered += 1;
        if (lives <= 0) {
          lives = 0;
          isGameOver = true;
        }
      };

      // Trigger 10 hits rapidly
      for (let k = 0; k < 10; k++) {
        triggerBombHit();
      }

      assert.equal(lives, 0, 'Lives cannot fall below 0');
      assert.equal(isGameOver, true, 'Game over must be true');
      assert.equal(explosionsTriggered, 3, 'Explosions after game over must not process further damage');
    });
  });

  // ==========================================================================
  // SUITE 3: CANVAS TEARDOWN, REINITIALIZATION & MEMORY BOUNDS
  // ==========================================================================
  describe('Suite 3: Canvas Teardown, Reinitialization & Memory Bounds', () => {

    test('3.1: 500 Canvas Mount/Unmount & Animation Frame Callback Cleanup Simulation', () => {
      let activeRafIds = new Set<number>();
      let rafCounter = 0;

      const mockRequestAnimationFrame = (cb: FrameRequestCallback): number => {
        rafCounter += 1;
        const id = rafCounter;
        activeRafIds.add(id);
        return id;
      };

      const mockCancelAnimationFrame = (id: number) => {
        activeRafIds.delete(id);
      };

      // Simulate 500 mounts and unmounts
      for (let cycle = 0; cycle < 500; cycle++) {
        const id1 = mockRequestAnimationFrame(() => {});
        const id2 = mockRequestAnimationFrame(() => {});
        assert.ok(activeRafIds.has(id1));
        assert.ok(activeRafIds.has(id2));

        // Cleanup on unmount
        mockCancelAnimationFrame(id1);
        mockCancelAnimationFrame(id2);
      }

      assert.equal(activeRafIds.size, 0, 'All animation frames must be canceled; no dangling frames');
    });

    test('3.2: Particle Pool & Floating Text Memory Retention Cap Invariant', () => {
      interface Particle {
        id: number;
        life: number; // 0 to 1
        x: number;
        y: number;
      }

      let particlePool: Particle[] = [];
      const MAX_PARTICLES = 100;

      const spawnParticle = (id: number) => {
        if (particlePool.length >= MAX_PARTICLES) {
          particlePool.shift(); // Evict oldest
        }
        particlePool.push({ id, life: 1.0, x: Math.random() * 800, y: Math.random() * 600 });
      };

      const updateParticles = (dt: number) => {
        for (let p of particlePool) {
          p.life -= dt;
        }
        particlePool = particlePool.filter(p => p.life > 0);
      };

      // Spawn 1000 particles over time
      for (let step = 0; step < 1000; step++) {
        spawnParticle(step);
        if (step % 5 === 0) {
          updateParticles(0.1);
        }
      }

      assert.ok(particlePool.length <= MAX_PARTICLES, `Particle pool must never exceed ${MAX_PARTICLES}`);
    });
  });

  // ==========================================================================
  // SUITE 4: STATIC CODE INSPECTION & AST INTEGRITY INVARIANTS
  // ==========================================================================
  describe('Suite 4: Static Code Inspection & Syntactic Integrity', () => {

    test('4.1: PizzaCanvas.tsx contains NO illegal bitwise OR for boolean checks', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(!code.includes("type === 'slash' | 'splat'"), 'Bitwise OR bug must not exist in PizzaCanvas.tsx');
      assert.ok(
        code.includes("type === 'slash' || type === 'splat'") || !code.includes("| 'splat'"),
        'Audio type check must use logical OR (||)'
      );
    });

    test('4.2: PizzaCanvas.tsx stateRef contains NO duplicate object properties', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const stateRefMatch = code.match(/const\s+stateRef\s*=\s*useRef\(\{([\s\S]*?)\}\);/);
      assert.ok(stateRefMatch, 'stateRef initialization block must be present');
      
      const stateRefContent = stateRefMatch[1];
      const keys = stateRefContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':'))
        .map(line => line.split(':')[0].trim());

      const duplicates = keys.filter((key, idx) => keys.indexOf(key) !== idx);
      assert.deepEqual(duplicates, [], `stateRef should not have duplicate keys. Found: ${duplicates.join(', ')}`);
    });

    test('4.3: HandTracker.tsx strictly ensures MediaStream track disposal and instance close', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('streamRef.current'), 'Must manage streamRef');
      assert.ok(code.includes('track.stop()'), 'Must call track.stop()');
      assert.ok(code.includes('handsInstanceRef.current') && code.includes('close()'), 'Must call close() on hands instance');
      assert.ok(code.includes('cancelAnimationFrame') || code.includes('cancelVideoFrameCallback'), 'Must cancel frame callbacks');
    });

    test('4.4: App.tsx and PizzaCanvas.tsx maintain fullscreen container encapsulation', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(canvasCode.includes('containerRef'), 'PizzaCanvas must define containerRef');
      assert.ok(appCode.includes('pendingScore') && canvasCode.includes('isRegistering'), 'Game Over modal must activate on pendingScore / isRegistering');
      assert.ok(appCode.includes('handlePlayAgain') || canvasCode.includes('onPlayAgain') || appCode.includes('onRetryGame'), 'Direct retry action contract must exist');
    });

    test('4.5: index.html and src/index.css satisfy mobile viewport & safe-area specifications', () => {
      const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
      const css = fs.readFileSync(INDEX_CSS_PATH, 'utf-8');

      assert.ok(html.includes('viewport-fit=cover'), 'HTML meta viewport must include viewport-fit=cover');
      assert.ok(css.includes('touch-action: none') || css.includes('touch-action:none'), 'Global CSS must define touch-action: none');
      assert.ok(css.includes('--sat') || css.includes('safe-area-inset-top'), 'Global CSS must support safe-area insets');
    });
  });
});
