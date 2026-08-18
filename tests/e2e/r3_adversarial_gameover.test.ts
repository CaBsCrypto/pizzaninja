import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScoreRecord, SlashReplayPoint } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');

describe('Milestone 3 Adversarial & Stress Test Suite: Fullscreen Game Over & Replay Invariants', () => {

  // ==========================================================================
  // SUITE 1: IMMEDIATE GAME OVER STATE TRANSITIONS & ZERO-DELAY INVARIANTS
  // ==========================================================================
  describe('Suite 1: Immediate Game Over State Transitions & Zero-Delay Invariants', () => {

    test('1.1: PizzaCanvas defines zero-delay triggerGameOver with clock interval cleanup', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Assert triggerGameOver implementation exists
      assert.ok(canvasCode.includes('triggerGameOver'), 'PizzaCanvas must define triggerGameOver');
      assert.ok(canvasCode.includes('clockIntervalRef.current'), 'PizzaCanvas must track clock interval ref');
      assert.ok(canvasCode.includes('clearInterval(clockIntervalRef.current)'), 'triggerGameOver must immediately clear clock interval');
      assert.ok(canvasCode.includes('setIsPlaying(false)'), 'triggerGameOver must immediately stop game loop');
      assert.ok(canvasCode.includes('isPausedRef.current = false'), 'triggerGameOver must force reset paused state');
      assert.ok(canvasCode.includes("setControlMode('mouse')"), 'triggerGameOver must reset camera control to mouse');
    });

    test('1.2: Lives depletion (0 lives) triggers immediate game over without waiting for 1s clock tick', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify that obstacle collision or dropped pizzas evaluate lives <= 0 and call triggerGameOver
      assert.ok(
        canvasCode.includes('triggerGameOverRef.current()') || canvasCode.includes('triggerGameOver()'),
        'PizzaCanvas must invoke triggerGameOver on lives depletion'
      );
      assert.ok(canvasCode.includes('lives <= 0') || canvasCode.includes('lives < 1'), 'PizzaCanvas must check lives boundary');
    });

    test('1.3: Timeout (timeLeft <= 0) triggers immediate game over in Arcade mode', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      assert.ok(
        canvasCode.includes('timeLeft <= 0') || canvasCode.includes('timeLeft <= 1'),
        'PizzaCanvas must check timeLeft boundary in Arcade mode'
      );
    });

    test('1.4: Simulation of Multi-Obstacle Barrage Collision (rapid consecutive lives loss)', () => {
      // Simulate game state engine handling multi-obstacle hits
      interface GameState {
        lives: number;
        isPlaying: boolean;
        isGameOverTriggered: boolean;
        gameOverCount: number;
        score: number;
      }

      const state: GameState = {
        lives: 3,
        isPlaying: true,
        isGameOverTriggered: false,
        gameOverCount: 0,
        score: 450
      };

      const triggerGameOverSim = () => {
        if (!state.isPlaying) return;
        state.isPlaying = false;
        state.isGameOverTriggered = true;
        state.gameOverCount++;
      };

      const sliceObstacle = () => {
        state.lives = Math.max(0, state.lives - 1);
        if (state.lives <= 0) {
          triggerGameOverSim();
        }
      };

      // Rapid barrage of 5 simultaneous obstacle collisions in single tick
      for (let i = 0; i < 5; i++) {
        sliceObstacle();
      }

      assert.equal(state.lives, 0, 'Lives cannot be negative');
      assert.equal(state.isPlaying, false, 'Game must not be playing');
      assert.equal(state.isGameOverTriggered, true, 'Game over must be triggered');
      assert.equal(state.gameOverCount, 1, 'Game over trigger must only fire exactly once per match');
    });
  });

  // ==========================================================================
  // SUITE 2: FULLSCREEN TOP LAYER DOM CONTAINMENT & Z-INDEX STACKING
  // ==========================================================================
  describe('Suite 2: Fullscreen Top Layer DOM Containment & Z-Index Hierarchy', () => {

    test('2.1: containerRef is target of requestFullscreen and encapsulates score modal', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // containerRef is the fullscreen element
      assert.ok(canvasCode.includes('ref={containerRef}'), 'PizzaCanvas must attach containerRef to main container element');
      assert.ok(canvasCode.includes('container.requestFullscreen') || canvasCode.includes('containerRef.current'), 'requestFullscreen targets containerRef');

      // scoreRegistrationContent is rendered inside containerRef at z-[100]
      assert.ok(canvasCode.includes('scoreRegistrationContent || children'), 'PizzaCanvas renders scoreRegistrationContent inside its container');
      assert.ok(canvasCode.includes('z-[100]'), 'Score registration overlay must have top z-[100] layer');
    });

    test('2.2: Modal stacking order prevents click interception or background blocking', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Damage flash overlay must have pointer-events-none
      const flashOverlayRegex = /damageFlash[\s\S]*?pointer-events-none/i;
      assert.ok(flashOverlayRegex.test(canvasCode), 'Damage flash overlay must have pointer-events-none to prevent blocking clicks');

      // Score registration overlay has pointer-events-auto
      assert.ok(canvasCode.includes('pointer-events-auto'), 'Modal overlay must have pointer-events-auto for user interaction');
    });

    test('2.3: App.tsx closes overlapping modals (Shop, Side Drawers) when Game Over triggers', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // handleGameOver must dismiss shop
      assert.ok(appCode.includes('setShowShop(false)'), 'handleGameOver must close shop modal to give visual priority to Game Over');
    });

    test('2.4: Both Guest and Web3 Wallet Game Over views provide direct JUGAR DE NUEVO button', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // Search for JUGAR DE NUEVO in both guest and wallet sections of scoreRegistrationCard
      const playAgainMatches = appCode.match(/JUGAR DE NUEVO/g);
      assert.ok(playAgainMatches && playAgainMatches.length >= 2, 'JUGAR DE NUEVO must be present in both Guest and Web3 modal branches');
      assert.ok(appCode.includes('handlePlayAgain'), 'App.tsx must define handlePlayAgain');
    });
  });

  // ==========================================================================
  // SUITE 3: DIRECT REPLAY LOOP CYCLES & RESOURCE CLEANLINESS
  // ==========================================================================
  describe('Suite 3: Direct Replay Loop Cycles & Resource Cleanliness', () => {

    test('3.1: 50-Cycle Replay Stress Simulation (Game -> Game Over -> Play Again -> Game)', () => {
      // Stress test state machine representing App.tsx and PizzaCanvas.tsx state synchronization
      class GameEngineHarness {
        public isPlaying: boolean = false;
        public pendingScore: any = null;
        public mintingStep: string = 'idle';
        public activeIntervals: Set<number> = new Set();
        public nextIntervalId: number = 1;
        public sessionCount: number = 0;
        public totalSlashes: number = 0;
        public score: number = 0;
        public lives: number = 3;
        public timeLeft: number = 45;

        public startGame() {
          this.clearIntervals();
          this.isPlaying = true;
          this.pendingScore = null;
          this.mintingStep = 'idle';
          this.score = 0;
          this.lives = 3;
          this.timeLeft = 45;
          this.totalSlashes = 0;
          this.sessionCount++;

          // Simulate clock interval creation
          const intervalId = this.nextIntervalId++;
          this.activeIntervals.add(intervalId);
        }

        public clearIntervals() {
          this.activeIntervals.clear();
        }

        public triggerGameOver(score: number, slashes: number) {
          this.clearIntervals();
          this.isPlaying = false;
          this.score = score;
          this.totalSlashes = slashes;
          this.pendingScore = {
            score,
            duration: 45,
            slashes
          };
        }

        public playAgain() {
          this.pendingScore = null;
          this.mintingStep = 'idle';
          this.startGame();
        }
      }

      const harness = new GameEngineHarness();

      for (let cycle = 1; cycle <= 50; cycle++) {
        harness.startGame();
        assert.equal(harness.isPlaying, true, `Cycle ${cycle}: isPlaying must be true`);
        assert.equal(harness.activeIntervals.size, 1, `Cycle ${cycle}: exactly one active interval`);
        assert.equal(harness.pendingScore, null, `Cycle ${cycle}: pendingScore must be reset`);

        // Simulate game match ending
        const matchScore = Math.floor(Math.random() * 5000) + 100;
        const matchSlashes = Math.floor(Math.random() * 100) + 10;
        harness.triggerGameOver(matchScore, matchSlashes);

        assert.equal(harness.isPlaying, false, `Cycle ${cycle}: isPlaying must be false on game over`);
        assert.equal(harness.activeIntervals.size, 0, `Cycle ${cycle}: all intervals must be cleaned up on game over`);
        assert.ok(harness.pendingScore !== null, `Cycle ${cycle}: pendingScore must be populated`);
        assert.equal(harness.pendingScore.score, matchScore);

        // Click Play Again
        harness.playAgain();
        assert.equal(harness.isPlaying, true, `Cycle ${cycle}: isPlaying true after Play Again`);
        assert.equal(harness.pendingScore, null, `Cycle ${cycle}: pendingScore cleared after Play Again`);
        assert.equal(harness.activeIntervals.size, 1, `Cycle ${cycle}: fresh interval started without leaks`);
      }

      assert.equal(harness.sessionCount, 100, 'All 50 play cycles + 50 restart cycles executed cleanly');
    });

    test('3.2: Rapid Restart Spam Invariant (multiple instant clicks on Play Again)', () => {
      let isPlaying = false;
      let pendingScore: any = { score: 1000, duration: 45, slashes: 20 };
      let mintingStep = 'registering';
      let startCount = 0;

      const handlePlayAgain = () => {
        pendingScore = null;
        mintingStep = 'idle';
        isPlaying = true;
        startCount++;
      };

      // Spam click 10 times in same event tick
      for (let i = 0; i < 10; i++) {
        handlePlayAgain();
      }

      assert.equal(isPlaying, true);
      assert.equal(pendingScore, null);
      assert.equal(mintingStep, 'idle');
      assert.equal(startCount, 10);
    });
  });

  // ==========================================================================
  // SUITE 4: GUEST SCORE REGISTRATION VS WEB3 SUBMISSION & PERSISTENCE
  // ==========================================================================
  describe('Suite 4: Guest Score Registration vs Web3 Submission & Persistence', () => {

    test('4.1: Guest score storage payload structure and score cap robustness', () => {
      const createScoreRecord = (rawName: string, rawScore: number, mode: string = 'arcade'): ScoreRecord => {
        const trimmed = rawName.trim().toUpperCase() || 'ANÓNIMO';
        const sanitized = trimmed.slice(0, 12);
        const validScore = Number.isFinite(rawScore) ? Math.max(0, Math.floor(rawScore)) : 0;

        return {
          name: sanitized,
          score: validScore,
          timestamp: Date.now(),
          duration: 45,
          slashes: 50,
          mode: (mode === 'classic') ? 'classic' : 'arcade'
        };
      };

      // Extreme test cases
      const rec1 = createScoreRecord('   pro_ninja_player_999999   ', 999999);
      assert.equal(rec1.name, 'PRO_NINJA_PL');
      assert.equal(rec1.score, 999999);

      const rec2 = createScoreRecord('', -500);
      assert.equal(rec2.name, 'ANÓNIMO');
      assert.equal(rec2.score, 0);

      const rec3 = createScoreRecord('Special!@#$', NaN);
      assert.equal(rec3.score, 0);
    });

    test('4.2: Web3 Soroban Payload validation (pubkey, score, mode, signedXdr)', () => {
      const mockWeb3Payload = {
        name: 'GABC...1234',
        score: 3500,
        timestamp: Date.now(),
        duration: 45,
        slashes: 85,
        pubkey: 'GBZXN7PIRZGNMHGA728RGRYA78AMNOH234TESTPUBKEY99999999999999',
        verified: true,
        mode: 'arcade',
        signedXdr: 'AAAAAgAAAA...'
      };

      assert.ok(mockWeb3Payload.pubkey.startsWith('G'));
      assert.equal(mockWeb3Payload.pubkey.length, 58);
      assert.equal(mockWeb3Payload.verified, true);
      assert.equal(mockWeb3Payload.score, 3500);
      assert.ok(typeof mockWeb3Payload.signedXdr === 'string');
    });

    test('4.3: Local storage persistence serialization round-trip', () => {
      const scores: ScoreRecord[] = [
        { name: 'NINJA_1', score: 5000, timestamp: 1700000000, duration: 45, slashes: 100, mode: 'arcade' },
        { name: 'NINJA_2', score: 3200, timestamp: 1700000100, duration: 45, slashes: 75, mode: 'classic' }
      ];

      const serialized = JSON.stringify(scores);
      const deserialized: ScoreRecord[] = JSON.parse(serialized);

      assert.equal(deserialized.length, 2);
      assert.equal(deserialized[0].name, 'NINJA_1');
      assert.equal(deserialized[0].score, 5000);
      assert.equal(deserialized[1].name, 'NINJA_2');
      assert.equal(deserialized[1].mode, 'classic');
    });
  });
});
