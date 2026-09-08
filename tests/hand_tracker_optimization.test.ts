import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OneEuroFilter, drawConnectors, drawLandmarks } from '../src/components/HandTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');
const HAND_TRACKER_PATH = path.join(ROOT_DIR, 'src/components/HandTracker.tsx');

describe('HandTracker High-Performance Optimization & Zero-Latency Filtering Suite', () => {

  // ==========================================================================
  // 1. ONE EURO FILTER ($1€$) MATHEMATICAL & ROBUSTNESS TESTS
  // ==========================================================================
  describe('1. OneEuroFilter Mathematical & Kinematic Behavior', () => {

    test('1.1: First sample pass-through and state initialization', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      const res = filter.filter(0.42, 1000);
      assert.equal(res, 0.42, 'First value must pass through immediately');
    });

    test('1.2: Low-speed noise filtering (zero jitter at rest)', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      const baseVal = 0.5;
      const baseTime = 1000;
      filter.filter(baseVal, baseTime);

      // Simulate subtle high-frequency sensor tremor (+/- 0.01 at 60fps)
      let currentFiltered = baseVal;
      const filteredTremors: number[] = [];

      for (let i = 1; i <= 30; i++) {
        const noise = (i % 2 === 0 ? 1 : -1) * 0.01;
        const noisyInput = baseVal + noise;
        const t = baseTime + i * 16.67; // ~60fps
        currentFiltered = filter.filter(noisyInput, t);
        filteredTremors.push(Math.abs(currentFiltered - baseVal));
      }

      // Max residual deviation must be heavily dampened (< 0.005)
      const maxDeviation = Math.max(...filteredTremors);
      assert.ok(
        maxDeviation < 0.005,
        `Stationary hand tremor must be heavily filtered (max deviation: ${maxDeviation} < 0.005)`
      );
    });

    test('1.3: High-speed dynamic cutoff scaling (zero lag / instant response on fast slash)', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.1, 1000);

      // Fast slash moving from 0.1 to 0.9 across 5 frames (83ms)
      let val = 0.1;
      let lastFiltered = 0.1;
      for (let i = 1; i <= 5; i++) {
        val += 0.16; // rapid displacement
        const t = 1000 + i * 16.67;
        lastFiltered = filter.filter(val, t);
      }

      // At end of fast slash, dynamic cutoff should be large (> 50Hz) and filtered value closely tracks raw input
      const lag = Math.abs(val - lastFiltered);
      assert.ok(
        lag < 0.08,
        `High-speed slash must eliminate lag dynamically (observed lag: ${lag} < 0.08)`
      );
    });

    test('1.4: Handling dt <= 0 (stale / identical / duplicate timestamps)', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.5, 1000);

      // Duplicate timestamp: should return previous xPrev without error
      const dup = filter.filter(0.9, 1000);
      assert.equal(dup, 0.5, 'Duplicate timestamp must return cached value');
    });

    test('1.5: Clock jitter resilience (out-of-order timestamps must not corrupt tPrev)', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.5, 1000);

      // Out of order timestamp (earlier than tPrev)
      const outOfOrder = filter.filter(0.8, 950);
      assert.equal(outOfOrder, 0.5, 'Out-of-order timestamp must return cached value');

      // Next normal frame at t=1016 must compute dt from 1000 (16ms), NOT from 950 (66ms)
      const nextFrame = filter.filter(0.52, 1016);
      assert.ok(Number.isFinite(nextFrame), 'Next valid frame must be finite');
      // Verify deviation is normal for a 16ms delta
      assert.ok(Math.abs(nextFrame - 0.5) < 0.02, 'Must not exhibit huge velocity leap from corrupted tPrev');
    });

    test('1.6: Large time gap (dt > 1.0s) resets state cleanly', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.2, 1000);

      // Sudden 5 second jump (e.g. pause or tracking re-acquisition)
      const jumped = filter.filter(0.85, 6000);
      assert.equal(jumped, 0.85, 'Large time gap must reset state and pass new value cleanly');
    });

    test('1.7: Non-finite inputs (NaN and Infinity) do not brick filter', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.5, 1000);

      // Pass NaN value
      const resNaNVal = filter.filter(NaN, 1016);
      assert.equal(resNaNVal, 0.5, 'NaN input must return previous valid state');

      // Pass NaN timestamp
      const resNaNTs = filter.filter(0.55, NaN);
      assert.equal(resNaNTs, 0.5, 'NaN timestamp must return previous valid state');

      // Subsequent valid frame must work properly
      const recovered = filter.filter(0.52, 1032);
      assert.ok(Number.isFinite(recovered) && Math.abs(recovered - 0.5) < 0.02, 'Filter must recover cleanly');
    });

    test('1.8: General scaling support (arbitrary numeric ranges outside [0, 1])', () => {
      const filter = new OneEuroFilter(1.0, 15.0, 1.0);
      const val1 = filter.filter(500, 1000);
      assert.equal(val1, 500, 'Initial value 500 must not be clamped to 1');

      const val2 = filter.filter(505, 1016);
      assert.ok(val2 > 450 && val2 < 550, `Value must remain near 500 (got ${val2}), not clamped to 1`);

      const neg = new OneEuroFilter(1.0, 15.0, 1.0);
      const negVal = neg.filter(-50, 1000);
      assert.equal(negVal, -50, 'Negative value must not be clamped to 0');
    });

    test('1.9: Filter reset clears state for clean re-engagement', () => {
      const filter = new OneEuroFilter(1.65, 15.0, 1.0);
      filter.filter(0.9, 1000);
      filter.reset();

      // After reset, first value should pass through immediately regardless of timestamp
      const fresh = filter.filter(0.1, 500);
      assert.equal(fresh, 0.1, 'After reset, first value must pass through cleanly');
    });
  });

  // ==========================================================================
  // 2. DIAGNOSTIC OVERLAY FUNCTIONS ROBUSTNESS
  // ==========================================================================
  describe('2. Diagnostic Drawing Helpers Robustness (drawConnectors & drawLandmarks)', () => {

    const createMockCtx = () => {
      const calls: string[] = [];
      return {
        beginPath: () => calls.push('beginPath'),
        moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
        lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
        stroke: () => calls.push('stroke'),
        arc: (x: number, y: number, r: number) => calls.push(`arc(${x},${y},${r})`),
        fill: () => calls.push('fill'),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        calls,
      };
    };

    test('2.1: Gracefully handles null, undefined, or empty landmarks', () => {
      const ctx = createMockCtx();
      assert.doesNotThrow(() => drawConnectors(ctx as any, null as any, 320, 240, false, '#fff'));
      assert.doesNotThrow(() => drawConnectors(ctx as any, [] as any, 320, 240, false, '#fff'));
      assert.doesNotThrow(() => drawLandmarks(ctx as any, null as any, 320, 240, false, '#fff', '#000'));
      assert.doesNotThrow(() => drawLandmarks(ctx as any, [] as any, 320, 240, false, '#fff', '#000'));
      assert.equal(ctx.calls.length, 0, 'No drawing calls should occur on null/empty landmarks');
    });

    test('2.2: Gracefully handles sparse / missing landmark objects in array', () => {
      const ctx = createMockCtx();
      const sparseLandmarks: any[] = [];
      sparseLandmarks[0] = { x: 0.5, y: 0.5 };
      // index 1 missing
      sparseLandmarks[2] = { x: 0.6, y: 0.6 };

      assert.doesNotThrow(() => drawConnectors(ctx as any, sparseLandmarks, 320, 240, false, '#fff'));
      assert.doesNotThrow(() => drawLandmarks(ctx as any, sparseLandmarks, 320, 240, false, '#fff', '#000'));
    });

    test('2.3: Correctly applies mirror transformation', () => {
      const ctx = createMockCtx();
      const landmarks = [{ x: 0.25, y: 0.5 }];
      drawLandmarks(ctx as any, landmarks, 320, 240, true, '#10b981', '#f43f5e');

      // Mirror true: cx = (1 - 0.25) * 320 = 240, cy = 0.5 * 240 = 120
      assert.ok(ctx.calls.some(c => c.includes('arc(240,120')), 'Mirrored X coordinate must be (1 - x) * width');
    });
  });

  // ==========================================================================
  // 3. ARCHITECTURAL & CONTRACT VERIFICATION
  // ==========================================================================
  describe('3. Architectural Requirements & Contract Verification', () => {

    test('3.1: R1 Downscaling - 320x240 canvas pre-processing in tick', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('scaleCanvasRef'), 'Must reference scaleCanvasRef');
      assert.ok(code.includes('320') && code.includes('240'), 'Must downscale to 320x240');
      assert.ok(code.includes('drawImage(videoRef.current, 0, 0, 320, 240)'), 'Must draw frame to scaleCanvasRef at 320x240');
      assert.ok(code.includes('handsInstanceRef.current.send({ image: scaleCanvasRef.current })'), 'Must send downscaled canvas to MediaPipe');
    });

    test('3.2: R2 Smoothing - OneEuroFilter integration in dual-hand tracking pipeline', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('OneEuroFilter'), 'Must instantiate OneEuroFilter');
      assert.ok(code.includes('oneEuroFiltersRef'), 'Must track OneEuroFilter instances in ref');
      assert.ok(code.includes('filterX.filter(normX, now)'), 'Must filter X coordinate with OneEuroFilter');
      assert.ok(code.includes('filterY.filter(normY, now)'), 'Must filter Y coordinate with OneEuroFilter');
    });

    test('3.3: R3 Overhead Suppression - Bypasses overlayCanvasRef rendering when inactive/compact', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('shouldDrawOverlay'), 'Must compute shouldDrawOverlay flag');
      assert.ok(code.includes('!isCompactRef.current && showDiagnosticsRef.current'), 'Overlay must only draw when diagnostics open and not in compact/gameplay mode');
      assert.ok(code.includes('if (shouldDrawOverlay && overlayCanvasRef.current)'), 'Canvas drawing loop must be strictly guarded by shouldDrawOverlay');
    });

    test('3.4: R4 Integrity - Camera hardware cleanup contracts', () => {
      const code = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      assert.ok(code.includes('track.stop()'), 'Must stop media stream tracks');
      assert.ok(code.includes('handsInstanceRef.current.close()'), 'Must close MediaPipe hands instance');
      assert.ok(code.includes('cancelAnimationFrame') || code.includes('cancelVideoFrameCallback'), 'Must cancel frame loop');
    });
  });
});
