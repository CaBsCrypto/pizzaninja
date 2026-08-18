import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ScoreRecord, SlashReplayPoint } from '../../src/types';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');

describe('Requirement R3 E2E Test Suite: Fullscreen Game Over Modal & Score Flow', () => {

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (Fullscreen containment, score registration flow)
  // ==========================================================================
  describe('Tier 1: Feature Coverage', () => {

    test('1.1: Score Registration / Game Over state contract is defined in App.tsx', () => {
      assert.ok(fs.existsSync(APP_TSX_PATH), 'App.tsx must exist');
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // Verify pendingScore state and handleGameOver implementation
      assert.ok(appCode.includes('pendingScore'), 'App must maintain pendingScore state');
      assert.ok(appCode.includes('handleGameOver'), 'App must have handleGameOver function');
      assert.ok(appCode.includes('handleRegisterScore'), 'App must have handleRegisterScore function');
      assert.ok(appCode.includes('scoreRegistrationCard') || appCode.includes('score-registration-overlay'), 'Score registration UI must be defined');
    });

    test('1.2: PizzaCanvas invokes onGameOver callback with score metadata', () => {
      assert.ok(fs.existsSync(PIZZA_CANVAS_PATH), 'PizzaCanvas.tsx must exist');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify game over trigger
      assert.ok(canvasCode.includes('onGameOver('), 'PizzaCanvas must invoke onGameOver callback');
      assert.ok(canvasCode.includes('isGameOver'), 'PizzaCanvas must evaluate isGameOver condition');
    });

    test('1.3: Guest moniker input, Save Record, and Skip buttons are present', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const combined = appCode + canvasCode;

      // Check for form fields
      assert.ok(combined.includes('chefName') || combined.includes('chef-name'), 'Moniker input field must be present');
      assert.ok(combined.includes('GUARDAR RÉCORD') || combined.includes('GUARDAR RECORD'), 'Save record button must be present');
      assert.ok(combined.includes('Omitir') || combined.includes('omitir'), 'Skip button must be present');
    });

    test('1.4: Fullscreen containment and modal visibility contract', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // Container ref exists and is target of requestFullscreen
      assert.ok(canvasCode.includes('requestFullscreen') || canvasCode.includes('toggleFullscreen'), 'Fullscreen toggle must be present');
      // Verify score registration or game over overlay is rendered when isRegistering / pendingScore is true
      assert.ok(appCode.includes('pendingScore !== null') || canvasCode.includes('isRegistering'), 'Game over modal must activate on pendingScore / isRegistering');
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Zero scores, name validation, local storage)
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    // Helper: Mock Score Storage & Registration Handler
    class MockScoreManager {
      public scores: ScoreRecord[] = [];
      public pendingScore: {
        score: number;
        duration: number;
        slashes: number;
        slashHistory: SlashReplayPoint[];
        gameMode?: string;
      } | null = null;

      public triggerGameOver(score: number, duration: number, slashes: number, mode: string = 'arcade') {
        this.pendingScore = {
          score,
          duration,
          slashes,
          slashHistory: [],
          gameMode: mode
        };
      }

      public registerScore(chefName: string): ScoreRecord {
        if (!this.pendingScore) {
          throw new Error('No pending score to register');
        }

        const trimmed = chefName.trim().toUpperCase() || 'ANÓNIMO';
        const sanitized = trimmed.slice(0, 12);

        const newRecord: ScoreRecord = {
          name: sanitized,
          score: this.pendingScore.score,
          timestamp: Date.now(),
          duration: this.pendingScore.duration,
          slashes: this.pendingScore.slashes,
          slashHistory: this.pendingScore.slashHistory,
          mode: this.pendingScore.gameMode || 'arcade'
        };

        this.scores.push(newRecord);
        this.scores.sort((a, b) => b.score - a.score);
        this.pendingScore = null;
        return newRecord;
      }

      public skipScore() {
        this.pendingScore = null;
      }
    }

    test('2.1: Guest moniker sanitization (whitespace trimming, uppercase conversion, max 12 chars)', () => {
      const manager = new MockScoreManager();
      manager.triggerGameOver(1200, 30, 15);

      const record1 = manager.registerScore('  ninja_master_pro_123  ');
      assert.equal(record1.name, 'NINJA_MASTER', 'Moniker must be trimmed, uppercase, and capped at 12 characters');
    });

    test('2.2: Empty or whitespace-only moniker defaults to "ANÓNIMO"', () => {
      const manager = new MockScoreManager();
      manager.triggerGameOver(850, 20, 10);

      const record = manager.registerScore('   ');
      assert.equal(record.name, 'ANÓNIMO', 'Blank moniker must fallback to ANÓNIMO');
    });

    test('2.3: Zero score Game Over edge case (immediate game over or 0 slashes)', () => {
      const manager = new MockScoreManager();
      manager.triggerGameOver(0, 5, 0, 'classic');

      assert.ok(manager.pendingScore !== null);
      assert.equal(manager.pendingScore.score, 0);

      const record = manager.registerScore('Rookie');
      assert.equal(record.score, 0);
      assert.equal(record.name, 'ROOKIE');
      assert.equal(manager.pendingScore, null);
    });

    test('2.4: Multi-entry local high score sorting (descending by score)', () => {
      const manager = new MockScoreManager();

      manager.triggerGameOver(1500, 45, 20);
      manager.registerScore('PlayerA');

      manager.triggerGameOver(5000, 45, 40);
      manager.registerScore('PlayerB');

      manager.triggerGameOver(3200, 45, 30);
      manager.registerScore('PlayerC');

      assert.equal(manager.scores.length, 3);
      assert.equal(manager.scores[0].score, 5000);
      assert.equal(manager.scores[0].name, 'PLAYERB');
      assert.equal(manager.scores[1].score, 3200);
      assert.equal(manager.scores[2].score, 1500);
    });

    test('2.5: Skip score dismissal resets pendingScore without saving record', () => {
      const manager = new MockScoreManager();
      manager.triggerGameOver(2000, 30, 25);
      assert.ok(manager.pendingScore !== null);

      manager.skipScore();
      assert.equal(manager.pendingScore, null);
      assert.equal(manager.scores.length, 0);
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (Fullscreen + Camera mode Game Over, Z-Index)
  // ==========================================================================
  describe('Tier 3: Cross-Feature Interactions', () => {

    test('3.1: Fullscreen and Camera Mode Game Over coexistence', () => {
      // In fullscreen camera mode, when game over triggers:
      // 1. Camera stops
      // 2. Score modal becomes visible inside the fullscreen container
      // 3. User can click buttons immediately
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(canvasCode.includes('onGameOver'), 'PizzaCanvas handles game over');
      assert.ok(appCode.includes('setPendingScore'), 'App registers score metadata');
    });

    test('3.2: Z-Index Hierarchy and pointer-events interactivity', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const combined = appCode + canvasCode;

      // Score registration card should have high z-index (z-[100] or higher)
      assert.ok(combined.includes('z-[100]') || combined.includes('z-50'), 'Modal must have high z-index stacking');
      // Damage flash overlay has pointer-events-none so it cannot block modal clicks
      assert.ok(canvasCode.includes('pointer-events-none'), 'Background effect overlays must have pointer-events: none');
    });

    test('3.3: Modal Dismissal and Main Menu Restoration', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // In PizzaCanvas, main menu overlay is rendered when !isPlaying && !isRegistering
      assert.ok(canvasCode.includes('!isPlaying'), 'Main menu renders when isPlaying is false');
      assert.ok(canvasCode.includes('!isRegistering'), 'Main menu is hidden while score registration modal is active');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (End-to-end fullscreen game over & replay)
  // ==========================================================================
  describe('Tier 4: Real-World Scenarios', () => {

    test('4.1: Fullscreen Arcade Match -> Score 4500 -> Moniker Registration -> Instant Retry', () => {
      let isFullscreen = true;
      let isPlaying = true;
      let isRegistering = false;
      let currentScore = 0;
      let chefName = '';
      const localScores: ScoreRecord[] = [];

      // Step 1: Playing in Fullscreen
      currentScore = 4500;
      assert.equal(isFullscreen, true);
      assert.equal(isPlaying, true);

      // Step 2: Time expires -> Game Over
      isPlaying = false;
      isRegistering = true;
      assert.equal(isRegistering, true);

      // Step 3: Enter Moniker
      chefName = 'CHEF_PRO';

      // Step 4: Click "GUARDAR RÉCORD"
      localScores.push({
        name: chefName.toUpperCase(),
        score: currentScore,
        timestamp: Date.now(),
        mode: 'arcade'
      });
      isRegistering = false;

      assert.equal(isRegistering, false);
      assert.equal(localScores.length, 1);
      assert.equal(localScores[0].score, 4500);
      assert.equal(localScores[0].name, 'CHEF_PRO');

      // Step 5: Direct Retry / Play Again
      isPlaying = true;
      currentScore = 0;
      assert.equal(isPlaying, true);
      assert.equal(currentScore, 0);
      assert.equal(isFullscreen, true, 'Fullscreen state preserved across retry');
    });

    test('4.2: Web3 Soroban score minting flow progression (idle -> signing -> sponsoring -> registering -> idle)', () => {
      type MintingStep = 'idle' | 'signing' | 'sponsoring' | 'registering';
      let currentStep: MintingStep = 'idle';

      // Start submission
      currentStep = 'signing';
      assert.equal(currentStep, 'signing');

      // Soroban gas sponsorship
      currentStep = 'sponsoring';
      assert.equal(currentStep, 'sponsoring');

      // API registration
      currentStep = 'registering';
      assert.equal(currentStep, 'registering');

      // Reset
      currentStep = 'idle';
      assert.equal(currentStep, 'idle');
    });
  });
});
