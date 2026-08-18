import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const INDEX_CSS_PATH = path.join(ROOT_DIR, 'src/index.css');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');

describe('Challenger M1 Adversarial Stress Test Suite: Viewports, Edge Inputs & Pointer Capture', () => {

  // ==========================================================================
  // 1. ADVERSARIAL VIEWPORT DIMENSION MATRIX
  // ==========================================================================
  describe('1. Adversarial Viewport Dimension Matrix & Aspect Ratios', () => {

    interface ViewportCase {
      name: string;
      w: number;
      h: number;
      headerH: number;
      padding: number;
      expectedMinCanvasW: number;
      expectedMinCanvasH: number;
    }

    const testViewports: ViewportCase[] = [
      // Foldable phone closed / ultra-narrow portrait
      { name: 'Samsung Galaxy Fold (Outer Display)', w: 280, h: 653, headerH: 50, padding: 8, expectedMinCanvasW: 240, expectedMinCanvasH: 135 },
      // Ultra-budget compact device
      { name: 'Extreme Low-Res (320x480)', w: 320, h: 480, headerH: 50, padding: 8, expectedMinCanvasW: 260, expectedMinCanvasH: 140 },
      // Standard low-end iPhone
      { name: 'iPhone SE Portrait (375x667)', w: 375, h: 667, headerH: 60, padding: 12, expectedMinCanvasW: 320, expectedMinCanvasH: 180 },
      // Standard modern iPhone
      { name: 'iPhone 14 Portrait (390x844)', w: 390, h: 844, headerH: 60, padding: 16, expectedMinCanvasW: 340, expectedMinCanvasH: 190 },
      // Standard Android
      { name: 'Pixel 7 Portrait (412x915)', w: 412, h: 915, headerH: 60, padding: 16, expectedMinCanvasW: 360, expectedMinCanvasH: 200 },
      // Landscape compact mobile
      { name: 'iPhone SE Landscape (667x375)', w: 667, h: 375, headerH: 40, padding: 12, expectedMinCanvasW: 500, expectedMinCanvasH: 280 },
      // Landscape modern phone
      { name: 'iPhone 14 Landscape (844x390)', w: 844, h: 390, headerH: 40, padding: 16, expectedMinCanvasW: 550, expectedMinCanvasH: 300 },
      // Square smartwatch / square embedded widget
      { name: 'Square Viewport (500x500)', w: 500, h: 500, headerH: 50, padding: 12, expectedMinCanvasW: 420, expectedMinCanvasH: 230 },
      // Ultra-wide banner format
      { name: 'Ultra-Wide Strip (1200x300)', w: 1200, h: 300, headerH: 35, padding: 8, expectedMinCanvasW: 400, expectedMinCanvasH: 220 },
      // Small embedded iframe
      { name: 'Iframe Medium Rectangle (300x250)', w: 300, h: 250, headerH: 0, padding: 4, expectedMinCanvasW: 260, expectedMinCanvasH: 140 },
      // Tall iframe widget
      { name: 'Iframe Tall Widget (400x600)', w: 400, h: 600, headerH: 0, padding: 4, expectedMinCanvasW: 360, expectedMinCanvasH: 200 },
      // Wide iframe embed
      { name: 'Iframe Wide Embed (800x450)', w: 800, h: 450, headerH: 0, padding: 8, expectedMinCanvasW: 700, expectedMinCanvasH: 390 },
      // Desktop Full HD
      { name: 'Desktop 1080p (1920x1080)', w: 1920, h: 1080, headerH: 70, padding: 32, expectedMinCanvasW: 1200, expectedMinCanvasH: 675 },
    ];

    testViewports.forEach((vp) => {
      test(`Viewport Scaling Test: ${vp.name} (${vp.w}x${vp.h})`, () => {
        const availW = Math.max(0, vp.w - vp.padding * 2);
        const availH = Math.max(0, vp.h - vp.headerH - vp.padding * 2);

        // Aspect-ratio calculation for 16:9 canvas container fitting
        const targetAspect = 16 / 9;
        let fitW = availW;
        let fitH = availW / targetAspect;

        if (fitH > availH) {
          fitH = availH;
          fitW = availH * targetAspect;
        }

        assert.ok(fitW > 0, `Computed width for ${vp.name} must be > 0`);
        assert.ok(fitH > 0, `Computed height for ${vp.name} must be > 0`);
        assert.ok(fitW <= vp.w, `Computed width ${fitW} must not exceed viewport width ${vp.w}`);
        assert.ok(fitH <= vp.h, `Computed height ${fitH} must not exceed viewport height ${vp.h}`);
        assert.ok(fitW >= vp.expectedMinCanvasW, `Fit width ${fitW} should meet expected minimum ${vp.expectedMinCanvasW}`);
        assert.ok(fitH >= vp.expectedMinCanvasH, `Fit height ${fitH} should meet expected minimum ${vp.expectedMinCanvasH}`);
      });
    });
  });

  // ==========================================================================
  // 2. POINTER CAPTURE & TOUCH BOUNDARY RETENTION
  // ==========================================================================
  describe('2. Pointer Event Slicing & Boundary Retention Stress-Testing', () => {

    test('2.1: PizzaCanvas binds setPointerCapture on pointer down for uninterrupted drag', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(
        code.includes('setPointerCapture') || code.includes('setPointerCapture(e.pointerId)'),
        'handlePointerDown must invoke setPointerCapture on the canvas target'
      );
    });

    test('2.2: PizzaCanvas safely releases pointer capture on pointer up and cancel', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(
        code.includes('releasePointerCapture'),
        'handlePointerUp must invoke releasePointerCapture'
      );
      assert.ok(
        code.includes('onPointerCancel={handlePointerUp}'),
        'canvas must bind onPointerCancel to prevent stuck pointer down state'
      );
    });

    test('2.3: handlePointerLeave does NOT abort active touch swipes when dragging past canvas edges', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      
      // Look at handlePointerLeave implementation
      const leaveHandlerMatch = code.match(/const handlePointerLeave = \([\s\S]*?\n  \};/);
      assert.ok(leaveHandlerMatch, 'handlePointerLeave must be defined');
      
      const leaveBody = leaveHandlerMatch[0];
      // It must check pointerType === 'mouse' and !isMousePressed before clearing trail
      assert.ok(
        leaveBody.includes("e.pointerType === 'mouse'") && leaveBody.includes("!stateRef.current.isMousePressed"),
        'handlePointerLeave must only clear trail for unpressed mouse, keeping active touch strokes intact'
      );
    });

    test('2.4: Normalized Coordinate Projection handles sub-pixel and clamped boundaries without NaN', () => {
      function projectPointerCoord(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, canvasW: number, canvasH: number) {
        const x = rect.width > 0 ? ((clientX - rect.left) / rect.width) * canvasW : 0;
        const y = rect.height > 0 ? ((clientY - rect.top) / rect.height) * canvasH : 0;
        const pctX = canvasW > 0 ? x / canvasW : 0.5;
        const pctY = canvasH > 0 ? y / canvasH : 0.5;
        return { x, y, pctX, pctY };
      }

      // Simulate swipe starting inside canvas, moving far outside canvas boundary
      const rect = { left: 50, top: 100, width: 300, height: 200 };
      const canvasW = 800;
      const canvasH = 450;

      // Inside point
      const inside = projectPointerCoord(100, 150, rect, canvasW, canvasH);
      assert.ok(!Number.isNaN(inside.x) && !Number.isNaN(inside.y));
      assert.equal(inside.x, (50 / 300) * 800);

      // Outside left/top (negative offset)
      const outsideNeg = projectPointerCoord(0, 0, rect, canvasW, canvasH);
      assert.ok(!Number.isNaN(outsideNeg.x) && !Number.isNaN(outsideNeg.y));
      assert.ok(outsideNeg.x < 0);
      assert.ok(outsideNeg.y < 0);

      // Outside right/bottom (overshoot)
      const outsidePos = projectPointerCoord(500, 400, rect, canvasW, canvasH);
      assert.ok(!Number.isNaN(outsidePos.x) && !Number.isNaN(outsidePos.y));
      assert.ok(outsidePos.x > canvasW);
      assert.ok(outsidePos.y > canvasH);

      // Zero dimension edge case (collapsed rect)
      const zeroRect = { left: 0, top: 0, width: 0, height: 0 };
      const zeroResult = projectPointerCoord(50, 50, zeroRect, canvasW, canvasH);
      assert.equal(zeroResult.x, 0);
      assert.equal(zeroResult.y, 0);
      assert.equal(zeroResult.pctX, 0);
      assert.equal(zeroResult.pctY, 0);
    });
  });

  // ==========================================================================
  // 3. TOUCH TARGET ACCESSIBILITY & LAYOUT OVERFLOW MITIGATION
  // ==========================================================================
  describe('3. Touch Target Accessibility & Layout Resets', () => {

    test('3.1: Start game buttons specify min-h-[44px] touch target sizing', () => {
      const code = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(
        code.includes('min-h-[44px]'),
        'Play buttons or touch targets must include min-h-[44px] for mobile accessibility'
      );
    });

    test('3.2: Score Registration modal contains max-height and overflow scroll constraints', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      assert.ok(
        appCode.includes('max-h-[90vh]') || appCode.includes('max-h-['),
        'Score registration modal must specify max-h constraint'
      );
      assert.ok(
        appCode.includes('overflow-y-auto'),
        'Score registration modal must include overflow-y-auto to prevent clipping on low-height screens'
      );
    });

    test('3.3: App Header hides or minimizes on mobile during active gameplay', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      assert.ok(
        appCode.includes("isPlaying ? 'hidden md:flex' : 'flex'") ||
        appCode.includes("isPlaying ? 'hidden' : 'flex'"),
        'Header must minimize/hide during active mobile gameplay to grant maximum screen space'
      );
    });

    test('3.4: Floating Wallet Tab does not overlap canvas on mobile during active gameplay', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      assert.ok(
        appCode.includes("isPlaying ? 'hidden' : 'hidden md:flex'") ||
        appCode.includes("hidden md:flex"),
        'Floating wallet tab must be hidden on mobile or during active gameplay'
      );
    });

    test('3.5: Global CSS root prevents unwanted touch zooming and body scrolling', () => {
      const css = fs.readFileSync(INDEX_CSS_PATH, 'utf-8');
      assert.match(css, /touch-action:\s*none/i);
      assert.match(css, /overflow:\s*hidden/i);
      assert.match(css, /user-select:\s*none/i);
    });

    test('3.6: HTML Viewport Meta includes notch cover and zoom prevention', () => {
      const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
      assert.ok(html.includes('viewport-fit=cover'), 'Meta tag must contain viewport-fit=cover');
      assert.ok(html.includes('user-scalable=no') || html.includes('maximum-scale=1.0'), 'Meta tag must prevent accidental zoom gestures');
    });
  });
});
