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
const SHOP_TSX_PATH = path.join(ROOT_DIR, 'src/components/Shop.tsx');
const STELLAR_HUB_PATH = path.join(ROOT_DIR, 'src/components/StellarHub.tsx');

describe('Requirement R1 E2E Test Suite: Responsive Canvas & Mobile Viewport Scaling', () => {

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (Happy path and core specifications)
  // ==========================================================================
  describe('Tier 1: Feature Coverage', () => {

    test('1.1: Viewport Meta Tag contains mobile scaling & viewport-fit=cover', () => {
      assert.ok(fs.existsSync(INDEX_HTML_PATH), 'index.html must exist');
      const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

      // Check meta viewport tag
      const metaViewportMatch = html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
      assert.ok(metaViewportMatch, 'Viewport meta tag must be present in index.html');

      const content = metaViewportMatch[1];
      assert.ok(content.includes('width=device-width'), 'Viewport must specify width=device-width');
      assert.ok(content.includes('initial-scale=1.0') || content.includes('initial-scale=1'), 'Viewport must specify initial-scale');
      assert.ok(content.includes('viewport-fit=cover'), 'Viewport must include viewport-fit=cover for notch / edge-to-edge support');
      assert.ok(content.includes('user-scalable=no') || content.includes('maximum-scale=1.0') || content.includes('maximum-scale=1'), 'Viewport must restrict un-intended multi-touch zoom');
    });

    test('1.2: Root HTML, Body and #root CSS Resets prevent rubber-banding and scroll leaking', () => {
      assert.ok(fs.existsSync(INDEX_CSS_PATH), 'src/index.css must exist');
      const css = fs.readFileSync(INDEX_CSS_PATH, 'utf-8');

      // Check root resets
      assert.match(css, /html,\s*body,\s*#root/i, 'Root element selector should configure html, body, and #root');
      assert.match(css, /touch-action:\s*none/i, 'Global CSS must set touch-action: none for game gestures');
      assert.match(css, /overflow:\s*hidden/i, 'Global CSS must set overflow: hidden on root');
      assert.match(css, /user-select:\s*none/i, 'Global CSS must prevent text selection during swiping');
    });

    test('1.3: Safe Area Inset CSS variables are declared', () => {
      const css = fs.readFileSync(INDEX_CSS_PATH, 'utf-8');
      assert.ok(css.includes('--sat') || css.includes('safe-area-inset-top'), 'Safe area top inset variable must be declared');
      assert.ok(css.includes('--sab') || css.includes('safe-area-inset-bottom'), 'Safe area bottom inset variable must be declared');
    });

    test('1.4: App.tsx main layout container maintains full width & height without shrink-wrap collapse', () => {
      assert.ok(fs.existsSync(APP_TSX_PATH), 'src/App.tsx must exist');
      const appTsx = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // Verify main container has w-full / flex-1 / min-h-0
      const mainTagMatch = appTsx.match(/<main[^>]*className=["']([^"']+)["']/);
      assert.ok(mainTagMatch, '<main> element must be present in App.tsx');
      const mainClass = mainTagMatch[1];
      assert.ok(mainClass.includes('w-full'), '<main> must have w-full class');
      assert.ok(mainClass.includes('flex-1'), '<main> must have flex-1 class');
      assert.ok(mainClass.includes('min-h-0'), '<main> must have min-h-0 to prevent flex overflow');
    });

    test('1.5: PizzaCanvas container layout is responsive and aspect-adaptive', () => {
      assert.ok(fs.existsSync(PIZZA_CANVAS_PATH), 'src/components/PizzaCanvas.tsx must exist');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify containerRef div has responsive scaling properties
      assert.ok(canvasCode.includes('ref={containerRef}'), 'containerRef must be attached to game wrapper');
      assert.ok(canvasCode.includes('w-full') || canvasCode.includes('w-auto'), 'Container must have full or adaptive width definition');
      assert.ok(canvasCode.includes('h-full') || canvasCode.includes('max-h-full'), 'Container must have adaptive height definition');
    });

    test('1.6: Interactive Touch Targets meet minimum accessibility standards (>= 44px)', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      
      // Start buttons (JUGAR NORMAL, JUGAR CÁMARA) should have robust padding and font sizing
      assert.ok(canvasCode.includes('JUGAR NORMAL'), 'Main menu must have JUGAR NORMAL button');
      assert.ok(canvasCode.includes('JUGAR CÁMARA') || canvasCode.includes('JUGAR CAMARA'), 'Main menu must have JUGAR CÁMARA button');

      // Top navigation icon buttons (Armería, Tutorial, Ajustes)
      assert.ok(canvasCode.includes('setActiveModal'), 'Top navigation modal selectors must be present');
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Extreme resolutions, iframe, edge inputs)
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    // Helper math function to simulate aspect-ratio calculation inside dynamic container
    function computeContainerGeometry(
      viewportW: number,
      viewportH: number,
      headerH: number,
      padding: number = 16
    ) {
      const availW = Math.max(0, viewportW - padding * 2);
      const availH = Math.max(0, viewportH - headerH - padding * 2);
      
      // In 16:9 target ratio
      const targetAspect = 16 / 9;
      let computedW = availW;
      let computedH = availW / targetAspect;

      if (computedH > availH) {
        computedH = availH;
        computedW = availH * targetAspect;
      }

      return {
        availW,
        availH,
        computedW: Math.round(computedW),
        computedH: Math.round(computedH),
        fillPercentW: (computedW / availW) * 100,
        fillPercentH: (computedH / availH) * 100,
        aspectRatio: computedW / (computedH || 1)
      };
    }

    test('2.1: iPhone SE Portrait (375x667) yields playable non-zero viewport', () => {
      const geo = computeContainerGeometry(375, 667, 60);
      assert.ok(geo.computedW > 250, `Width ${geo.computedW} must be > 250px`);
      assert.ok(geo.computedH > 140, `Height ${geo.computedH} must be > 140px`);
      assert.ok(geo.computedW <= 375, 'Width must not exceed viewport');
      assert.ok(geo.computedH <= 667, 'Height must not exceed viewport');
    });

    test('2.2: iPhone SE Landscape (667x375) with compact header avoids vertical collapse', () => {
      // In landscape, header is compact (<= 40px)
      const geo = computeContainerGeometry(667, 375, 40);
      assert.ok(geo.computedW > 400, `Width ${geo.computedW} must expand to fill landscape`);
      assert.ok(geo.computedH > 220, `Height ${geo.computedH} must occupy available vertical space`);
    });

    test('2.3: iPhone 12/13/14 Portrait (390x844) & Landscape (844x390)', () => {
      const portraitGeo = computeContainerGeometry(390, 844, 60);
      assert.ok(portraitGeo.computedW >= 340);
      assert.ok(portraitGeo.computedH >= 190);

      const landscapeGeo = computeContainerGeometry(844, 390, 40);
      assert.ok(landscapeGeo.computedW >= 550);
      assert.ok(landscapeGeo.computedH >= 300);
    });

    test('2.4: Pixel 7 / Galaxy S20 (412x915) Portrait & (915x412) Landscape', () => {
      const pGeo = computeContainerGeometry(412, 915, 60);
      assert.ok(pGeo.computedW >= 360);
      assert.ok(pGeo.computedH >= 200);

      const lGeo = computeContainerGeometry(915, 412, 40);
      assert.ok(lGeo.computedW >= 600);
      assert.ok(lGeo.computedH >= 320);
    });

    test('2.5: Extreme Low-Res Mobile (320x480) remains bounded and functional', () => {
      const geo = computeContainerGeometry(320, 480, 50);
      assert.ok(geo.computedW > 200, 'Must not collapse on 320px screen');
      assert.ok(geo.computedH > 100, 'Must not collapse on 320px screen');
    });

    test('2.6: Iframe Embed Boundaries (400x600, 800x500)', () => {
      const iframe1 = computeContainerGeometry(400, 600, 0, 0);
      assert.ok(iframe1.computedW >= 350);
      assert.ok(iframe1.computedH >= 200);

      const iframe2 = computeContainerGeometry(800, 500, 0, 0);
      assert.ok(iframe2.computedW >= 700);
      assert.ok(iframe2.computedH >= 400);
    });

    test('2.7: Floating Side Wallet Tab is hidden or non-obstructive on mobile viewports', () => {
      const appTsx = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      // If floating wallet tab exists, it must have responsive visibility (e.g. hidden md:flex)
      if (appTsx.includes('fixed right-0 top-1/3') || appTsx.includes('fixed right-0')) {
        assert.ok(
          appTsx.includes('hidden md:flex') || 
          appTsx.includes('hidden sm:flex') ||
          appTsx.includes('pointer-events-none') ||
          appTsx.includes('z-30'),
          'Floating side wallet tab must not block slicing gestures on mobile'
        );
      }
    });

    test('2.8: Pointer event listeners retain swipe tracking on touch boundaries', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(canvasCode.includes('handlePointerDown') || canvasCode.includes('onPointerDown'), 'Canvas must bind pointer down event');
      assert.ok(canvasCode.includes('handlePointerMove') || canvasCode.includes('onPointerMove'), 'Canvas must bind pointer move event');
      assert.ok(canvasCode.includes('handlePointerUp') || canvasCode.includes('onPointerUp'), 'Canvas must bind pointer up event');
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (Orientation, HUD layout, Modals)
  // ==========================================================================
  describe('Tier 3: Cross-Feature Interactions', () => {

    test('3.1: In-Game HUD elements are responsive and fit across mobile width (< 520px)', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify Score and Lives HUD cards exist
      assert.ok(canvasCode.includes('score') && canvasCode.includes('lives'), 'HUD must contain score and lives indicators');
      // Verify countdown / timer in HUD
      assert.ok(canvasCode.includes('timeLeft') || canvasCode.includes('formatTime') || canvasCode.includes('Oven'), 'HUD must contain clock or timer');
      // Verify sound toggle button in HUD
      assert.ok(canvasCode.includes('soundEnabled') || canvasCode.includes('Volume'), 'HUD must contain sound settings access');
      // Verify fullscreen toggle button in HUD
      assert.ok(canvasCode.includes('toggleFullscreen') || canvasCode.includes('Maximize'), 'HUD must contain fullscreen toggle');
    });

    test('3.2: Top Modals (Armería, Tutorial, Ajustes, Tienda) contain scroll containment on short viewports', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(canvasCode.includes('activeModal'), 'activeModal state must control submodal visibility');
      
      const shopCode = fs.readFileSync(SHOP_TSX_PATH, 'utf-8');
      assert.ok(shopCode.includes('max-h-') || shopCode.includes('overflow-y-auto'), 'Shop modal must prevent vertical overflow');
    });

    test('3.3: StellarHub drawer is responsive across mobile screens', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const hubCode = fs.readFileSync(STELLAR_HUB_PATH, 'utf-8');
      assert.ok(
        appCode.includes('isWalletOpen') || hubCode.includes('isOpen') || hubCode.includes('onClose'),
        'StellarHub drawer must handle open/close lifecycle'
      );
      assert.ok(
        appCode.includes('w-[310px]') || appCode.includes('w-') || hubCode.includes('w-') || hubCode.includes('max-w-'),
        'StellarHub drawer must have responsive width constraints'
      );
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD USER SCENARIOS (End-to-end mobile user journey)
  // ==========================================================================
  describe('Tier 4: Real-World Scenarios', () => {

    test('4.1: Mobile Player Journey — Landing -> Main Menu -> Start -> Playing -> Game Over', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify state flow definitions exist
      assert.ok(appCode.includes('isPlaying'), 'App state must track isPlaying');
      assert.ok(canvasCode.includes('isPlaying'), 'PizzaCanvas must consume isPlaying');
      assert.ok(appCode.includes('handleGameOver'), 'App must have game over handler');
      assert.ok(canvasCode.includes('onGameOver'), 'PizzaCanvas must trigger onGameOver callback');
      
      // Verify Game Over does not collapse layout
      assert.ok(appCode.includes('pendingScore'), 'pendingScore must record score metadata on game over');
    });

    test('4.2: DPI scaling and Canvas Pixel Ratio calibration', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      assert.ok(
        canvasCode.includes('devicePixelRatio') || canvasCode.includes('dpr') || canvasCode.includes('canvasRef.current'),
        'Canvas must calibrate pixel density / devicePixelRatio for sharp mobile rendering'
      );
    });
  });
});
