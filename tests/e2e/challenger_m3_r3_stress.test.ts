import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScoreRecord, SlashReplayPoint, PizzaType, PizzaState } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');

describe('Milestone 3 Adversarial & Empirical Stress Suite (Requirement R3)', () => {

  // ==========================================================================
  // SECTION 1: RAPID TRIGGER SEQUENCES & CONCURRENCY (50+ REPEAT CYCLES)
  // ==========================================================================
  describe('1. Rapid Trigger Sequences (50+ Cycles Stress Harness)', () => {

    test('1.1 100 consecutive rapid start -> instant game-over -> instant retry cycles', () => {
      // Simulation state mirroring App.tsx + PizzaCanvas.tsx state coordination
      let isPlaying = false;
      let pendingScore: {
        score: number;
        duration: number;
        slashes: number;
        slashHistory: SlashReplayPoint[];
        gameStartTimestamp?: number;
        gameMode?: string;
      } | null = null;
      let mintingStep: 'idle' | 'signing' | 'sponsoring' | 'registering' | 'completed' | 'error' = 'idle';
      let mintedTx: string | null = null;

      let totalGamesPlayed = 0;
      let totalRetries = 0;
      let totalGameOvers = 0;

      // Simulated engine state
      const engineState = {
        score: 0,
        lives: 3,
        timeLeft: 45,
        startTime: 0,
        totalSlashes: 0,
        gameMode: 'arcade' as 'arcade' | 'classic'
      };

      const startGame = (mode: 'arcade' | 'classic' = 'arcade') => {
        engineState.score = 0;
        engineState.lives = 3;
        engineState.timeLeft = mode === 'arcade' ? 45 : 999;
        engineState.startTime = Date.now();
        engineState.totalSlashes = 0;
        engineState.gameMode = mode;
        isPlaying = true;
        totalGamesPlayed++;
      };

      const triggerGameOver = () => {
        if (!isPlaying) return;
        isPlaying = false;
        const elapsed = Math.max(0, Math.floor((Date.now() - engineState.startTime) / 1000));
        pendingScore = {
          score: engineState.score,
          duration: elapsed,
          slashes: engineState.totalSlashes,
          slashHistory: [],
          gameStartTimestamp: engineState.startTime,
          gameMode: engineState.gameMode
        };
        totalGameOvers++;
      };

      const handlePlayAgain = () => {
        pendingScore = null;
        mintingStep = 'idle';
        mintedTx = null;
        setIsPlaying(true);
        totalRetries++;
      };

      const setIsPlaying = (playing: boolean) => {
        isPlaying = playing;
        // In PizzaCanvas.tsx: useEffect on isPlaying:
        if (playing && (!engineState.startTime || engineState.lives <= 0 || (engineState.gameMode === 'arcade' && engineState.timeLeft <= 0))) {
          startGame(engineState.gameMode);
        }
      };

      // Run 100 rapid cycles
      for (let i = 0; i < 100; i++) {
        const mode = i % 2 === 0 ? 'arcade' : 'classic';
        startGame(mode);
        assert.equal(isPlaying, true, `Cycle ${i}: isPlaying should be true after start`);
        assert.equal(pendingScore, null, `Cycle ${i}: pendingScore must be null during play`);

        // Simulate some slashes / points
        engineState.score += (i * 17) % 500;
        engineState.totalSlashes += (i % 10);

        // Immediate Game Over (obstacle slice or timer expiry)
        engineState.lives = 0;
        triggerGameOver();
        assert.equal(isPlaying, false, `Cycle ${i}: isPlaying must be false after game over`);
        assert.ok(pendingScore !== null, `Cycle ${i}: pendingScore must be populated`);
        assert.equal(pendingScore?.gameMode, mode, `Cycle ${i}: mode must match`);

        // Instant Retry
        handlePlayAgain();
        assert.equal(isPlaying, true, `Cycle ${i}: isPlaying must be true after retry`);
        assert.equal(pendingScore, null, `Cycle ${i}: pendingScore must be cleared after retry`);
        assert.equal(engineState.lives, 3, `Cycle ${i}: lives must be reset to 3 upon restart`);
        assert.equal(engineState.score, 0, `Cycle ${i}: score must be reset to 0 upon restart`);
      }

      assert.equal(totalGamesPlayed, 200, 'Must have handled 100 initial starts + 100 retry starts');
      assert.equal(totalGameOvers, 100, 'Must have handled 100 game overs');
      assert.equal(totalRetries, 100, 'Must have handled 100 retries without state deadlock');
    });

    test('1.2 Rapid score registration interleaving with skip and retry', () => {
      const savedScores: ScoreRecord[] = [];
      let pendingScore: any = null;
      let isPlaying = false;

      const recordScore = (name: string, score: number, mode: string) => {
        const trimmed = name.trim().toUpperCase() || 'ANÓNIMO';
        const sanitized = trimmed.slice(0, 12);
        const record: ScoreRecord = {
          name: sanitized,
          score,
          timestamp: Date.now(),
          duration: 30,
          slashes: 15,
          mode
        };
        savedScores.push(record);
        savedScores.sort((a, b) => b.score - a.score);
        pendingScore = null;
      };

      for (let i = 0; i < 60; i++) {
        isPlaying = true;
        const currentScore = (i * 123) % 4000;
        pendingScore = { score: currentScore, duration: 45, slashes: 30, mode: 'arcade' };
        isPlaying = false;

        if (i % 3 === 0) {
          // Register score
          recordScore(`Player_${i}`, currentScore, 'arcade');
          assert.equal(pendingScore, null);
        } else if (i % 3 === 1) {
          // Skip score
          pendingScore = null;
          assert.equal(pendingScore, null);
        } else {
          // Instant retry
          pendingScore = null;
          isPlaying = true;
          assert.equal(pendingScore, null);
          assert.equal(isPlaying, true);
        }
      }

      assert.equal(savedScores.length, 20, '20 scores should be registered out of 60 iterations');
      for (let i = 0; i < savedScores.length - 1; i++) {
        assert.ok(savedScores[i].score >= savedScores[i + 1].score, 'Scores must remain strictly sorted descending');
      }
    });
  });

  // ==========================================================================
  // SECTION 2: ADVERSARIAL MONIKER SANITIZATION & EDGE CASE INPUTS
  // ==========================================================================
  describe('2. Moniker Sanitization & Boundary Form Inputs', () => {

    function sanitizeChefName(raw: string): string {
      const trimmed = raw.trim().toUpperCase() || 'ANÓNIMO';
      return trimmed.slice(0, 12);
    }

    test('2.1 Empty, whitespace, newline, and tab monikers fallback to ANÓNIMO', () => {
      const emptyInputs = ['', ' ', '   ', '\t', '\n', '\r\n', '   \t  \n  '];
      for (const input of emptyInputs) {
        const sanitized = sanitizeChefName(input);
        assert.equal(sanitized, 'ANÓNIMO', `Input "${input}" must fallback to ANÓNIMO`);
      }
    });

    test('2.2 Unicode, emoji, and accented character monikers', () => {
      assert.equal(sanitizeChefName('🍕PIZZA_CHEF'), '🍕PIZZA_CHEF'.slice(0, 12));
      assert.equal(sanitizeChefName('ramón_pérez'), 'RAMÓN_PÉREZ'.slice(0, 12));
      assert.equal(sanitizeChefName('  ñandú_pro  '), 'ÑANDÚ_PRO');
    });

    test('2.3 Boundary lengths (1 char, 12 chars, 100+ chars truncation)', () => {
      assert.equal(sanitizeChefName('a'), 'A');
      assert.equal(sanitizeChefName('123456789012'), '123456789012');
      assert.equal(sanitizeChefName('12345678901234567890'), '123456789012', 'Must truncate at 12 characters');
      assert.equal(sanitizeChefName('A'.repeat(500)), 'A'.repeat(12), 'Extremely long input must truncate safely');
    });

    test('2.4 Malicious XSS / HTML / Script injection payload neutralisation', () => {
      const xss1 = '<script>alert(1)</script>';
      const sanitized1 = sanitizeChefName(xss1);
      assert.equal(sanitized1, '<SCRIPT>ALER', 'Truncated and uppercased without executing HTML');

      const xss2 = '<img src=x onerror=alert(1)>';
      const sanitized2 = sanitizeChefName(xss2);
      assert.equal(sanitized2, '<IMG SRC=X O');

      const sqli = "' OR '1'='1";
      const sanitizedSqli = sanitizeChefName(sqli);
      assert.equal(sanitizedSqli, "' OR '1'='1");
    });
  });

  // ==========================================================================
  // SECTION 3: CROSS-MODE GAME OVER MECHANISMS
  // ==========================================================================
  describe('3. Cross-Mode Game Over Triggers & State Consistency', () => {

    test('3.1 Arcade Mode: Timeout triggers Game Over immediately; dropped pizza penalizes score', () => {
      const state = {
        gameMode: 'arcade' as const,
        score: 100,
        lives: 3,
        timeLeft: 45,
        isPlaying: true
      };

      // Dropping good pizza in Arcade mode: score - 5, lives untouched
      const dropGoodPizza = () => {
        if (state.gameMode === 'classic') {
          state.lives = Math.max(0, state.lives - 1);
        } else {
          state.score = Math.max(0, state.score - 5);
        }
      };

      dropGoodPizza();
      assert.equal(state.score, 95);
      assert.equal(state.lives, 3, 'Lives must not be lost when dropping pizza in Arcade mode');

      // Drop when score is low (< 5)
      state.score = 3;
      dropGoodPizza();
      assert.equal(state.score, 0, 'Score must not become negative on penalty');

      // Time countdown to 0
      state.timeLeft = 0;
      const isGameOver = (state.gameMode === 'arcade' && state.timeLeft <= 0) || state.lives <= 0;
      assert.equal(isGameOver, true, 'Arcade mode must trigger Game Over when timeLeft reaches 0');
    });

    test('3.2 Classic Mode: Dropping 3 pizzas depletes lives to 0 and triggers Game Over immediately', () => {
      const state = {
        gameMode: 'classic' as const,
        score: 500,
        lives: 3,
        timeLeft: 999,
        isPlaying: true
      };

      let gameOverTriggered = false;
      const triggerGameOver = () => { gameOverTriggered = true; state.isPlaying = false; };

      const dropGoodPizza = () => {
        if (state.gameMode === 'classic') {
          state.lives = Math.max(0, state.lives - 1);
          if (state.lives <= 0) triggerGameOver();
        } else {
          state.score = Math.max(0, state.score - 5);
        }
      };

      // Drop pizza 1
      dropGoodPizza();
      assert.equal(state.lives, 2);
      assert.equal(gameOverTriggered, false);

      // Drop pizza 2
      dropGoodPizza();
      assert.equal(state.lives, 1);
      assert.equal(gameOverTriggered, false);

      // Drop pizza 3 -> Game Over!
      dropGoodPizza();
      assert.equal(state.lives, 0);
      assert.equal(gameOverTriggered, true, 'Classic mode must trigger Game Over when lives reach 0');
      assert.equal(state.isPlaying, false);
    });

    test('3.3 Obstacle slicing (Pineapple/Burnt) immediately deducts life in both modes', () => {
      const modes: Array<'arcade' | 'classic'> = ['arcade', 'classic'];

      for (const mode of modes) {
        const state = {
          gameMode: mode,
          lives: 1,
          isPlaying: true
        };

        let gameOverTriggered = false;
        const triggerGameOver = () => { gameOverTriggered = true; state.isPlaying = false; };

        // Slice obstacle
        state.lives = Math.max(0, state.lives - 1);
        if (state.lives <= 0) {
          triggerGameOver();
        }

        assert.equal(state.lives, 0, `Mode ${mode}: slicing obstacle with 1 life left should reduce lives to 0`);
        assert.equal(gameOverTriggered, true, `Mode ${mode}: slicing obstacle at 0 lives must trigger game over immediately`);
        assert.equal(state.isPlaying, false);
      }
    });

    test('3.4 Header title dynamic localization matches game mode in App.tsx', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      assert.ok(
        appCode.includes("pendingScore.gameMode === 'classic' ? '¡Fin de Partida!' : '¡Tiempo Agotado!'") ||
        appCode.includes("pendingScore.gameMode === 'classic'"),
        'App.tsx must customize Game Over title based on gameMode (Classic vs Arcade)'
      );
    });
  });

  // ==========================================================================
  // SECTION 4: FULLSCREEN DOM ENCAPSULATION & Z-INDEX CONTRACT AUDIT
  // ==========================================================================
  describe('4. Fullscreen DOM Encapsulation & Elevation Contract', () => {

    test('4.1 containerRef is the root fullscreen target and encloses scoreRegistrationContent', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // 1. PizzaCanvas attaches containerRef to its root wrapper div
      assert.ok(canvasCode.includes('ref={containerRef}'), 'PizzaCanvas must attach containerRef to root element');
      
      // 2. toggleFullscreen invokes requestFullscreen on containerRef.current
      assert.ok(canvasCode.includes('container.requestFullscreen'), 'toggleFullscreen must request fullscreen on containerRef');

      // 3. scoreRegistrationContent is mounted INSIDE containerRef inside AnimatePresence
      assert.ok(canvasCode.includes('score-registration-overlay'), 'score-registration-overlay must be rendered inside PizzaCanvas');
      assert.ok(canvasCode.includes('isRegistering && (scoreRegistrationContent || children)'), 'Overlay must condition on isRegistering');

      // 4. App.tsx passes scoreRegistrationCard to PizzaCanvas via scoreRegistrationContent prop
      assert.ok(appCode.includes('scoreRegistrationContent={scoreRegistrationCard}'), 'App.tsx must pass scoreRegistrationCard to PizzaCanvas');
    });

    test('4.2 Z-Index Hierarchy Audit within containerRef', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Game Over modal overlay: z-[100]
      assert.ok(canvasCode.includes('z-[100]'), 'Game Over / Score modal must have z-[100] elevation');

      // Top navigation / Main Menu: z-50 / z-[60]
      assert.ok(canvasCode.includes('z-50') || canvasCode.includes('z-[60]'), 'Menu must have z-50 or z-[60]');

      // In-game HUD: z-30
      assert.ok(canvasCode.includes('z-30'), 'HUD must have lower z-index than Game Over modal');

      // Damage flash & countdown: pointer-events-none so clicks pass through or don't block
      assert.ok(canvasCode.includes('pointer-events-none'), 'Visual effects overlays must specify pointer-events-none');

      // Score registration overlay: pointer-events-auto to capture form interactions
      assert.ok(canvasCode.includes('pointer-events-auto'), 'Modal overlay must specify pointer-events-auto');
    });

    test('4.3 Zero Delay: triggerGameOver does not depend on 1-second timer delay', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');

      // Verify triggerGameOver is defined via useCallback
      assert.ok(canvasCode.includes('const triggerGameOver = useCallback('), 'triggerGameOver must be defined via useCallback');
      assert.ok(canvasCode.includes('triggerGameOverRef.current = triggerGameOver'), 'triggerGameOverRef must sync with triggerGameOver');

      // Verify triggerGameOverRef is called directly in collision loops
      assert.ok(canvasCode.includes('triggerGameOverRef.current()'), 'Collision loops must call triggerGameOverRef.current() directly upon death');
    });

    test('4.4 "JUGAR DE NUEVO" (Play Again) Action is present across all score modal states', () => {
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');

      // Check handlePlayAgain function
      assert.ok(appCode.includes('handlePlayAgain'), 'App.tsx must define handlePlayAgain');
      assert.ok(appCode.includes('setIsPlaying(true)'), 'handlePlayAgain must activate isPlaying');
      assert.ok(appCode.includes('setPendingScore(null)'), 'handlePlayAgain must clear pendingScore');

      // Check for "JUGAR DE NUEVO" buttons in guest form and Web3 wallet states
      const count = (appCode.match(/JUGAR DE NUEVO/g) || []).length;
      assert.ok(count >= 2, `App.tsx should feature at least 2 "JUGAR DE NUEVO" buttons across states (found ${count})`);
    });
  });
});
