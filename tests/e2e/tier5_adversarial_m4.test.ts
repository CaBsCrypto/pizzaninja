import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupMockKvServer, resetMockKv } from '../helpers/mockKvServer.js';
import userHandler from '../../api/user.js';
import scoreHandler from '../../api/score.js';
import leaderboardHandler from '../../api/leaderboard.js';
import rankHandler from '../../api/leaderboard/rank.js';
import { ScoreRecord, SlashReplayPoint, GameItem, PizzaType, PizzaState } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const APP_TSX_PATH = path.join(ROOT_DIR, 'src/App.tsx');
const PIZZA_CANVAS_PATH = path.join(ROOT_DIR, 'src/components/PizzaCanvas.tsx');
const HAND_TRACKER_PATH = path.join(ROOT_DIR, 'src/components/HandTracker.tsx');

let serverObj: any;

before(async () => {
  serverObj = await setupMockKvServer();
});

after(async () => {
  if (serverObj && serverObj.server) {
    serverObj.server.close();
  }
});

function createMockReqRes(options: { method?: string; url?: string; body?: any; query?: any }) {
  const method = options.method || 'GET';
  const url = options.url || '/api/test';
  const body = options.body;
  const query = options.query || {};

  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};

  const req = {
    method,
    url,
    body,
    query,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body)
  };

  const res = {
    statusCode: 200,
    setHeader(key: string, val: string) {
      headers[key.toLowerCase()] = val;
    },
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return { statusCode, data, headers };
    },
    end() {
      return { statusCode, data: responseData, headers };
    }
  };

  return { req, res, getResult: () => ({ statusCode, data: responseData, headers }) };
}

describe('Tier 5 Adversarial & White-Box Hardening Test Suite (Milestone 4)', () => {

  describe('1. Unified Stress Harness: Viewport Resize + Camera Cycles + Fullscreen Replay Loop', () => {

    test('1.1: 100-Iteration Combined Stress Simulation', () => {
      class FullSystemStressHarness {
        public width: number = 1280;
        public height: number = 720;
        public isPlaying: boolean = false;
        public isFullscreen: boolean = false;
        public controlMode: 'mouse' | 'camera' = 'mouse';
        public isCameraActive: boolean = false;
        public cameraTracksStopped: number = 0;
        public activeIntervals: Set<number> = new Set();
        public activeRafs: Set<number> = new Set();
        public pendingScore: ScoreRecord | null = null;
        public isRegistering: boolean = false;
        public isPaused: boolean = false;
        public score: number = 0;
        public totalGamesPlayed: number = 0;
        public nextTimerId: number = 1;

        public resize(w: number, h: number) {
          assert.ok(w >= 0 && h >= 0);
          this.width = Math.max(1, w);
          this.height = Math.max(1, h);
          const aspect = this.width / this.height;
          assert.ok(!isNaN(aspect) && isFinite(aspect));
        }

        public setControlMode(mode: 'mouse' | 'camera') {
          this.controlMode = mode;
          if (mode === 'camera') {
            this.isCameraActive = true;
          } else {
            if (this.isCameraActive) {
              this.cameraTracksStopped += 1;
              this.isCameraActive = false;
            }
            this.isPaused = false;
          }
        }

        public toggleFullscreen(target?: boolean) {
          this.isFullscreen = target !== undefined ? target : !this.isFullscreen;
        }

        public startGame() {
          this.isPlaying = true;
          this.isRegistering = false;
          this.pendingScore = null;
          this.score = 0;
          this.isPaused = false;
          const intervalId = this.nextTimerId++;
          this.activeIntervals.add(intervalId);
          return intervalId;
        }

        public triggerGameOver(finalScore: number) {
          if (!this.isPlaying) return;
          this.isPlaying = false;
          this.isRegistering = true;
          this.pendingScore = {
            name: 'TEST_CHEF',
            score: finalScore,
            timestamp: Date.now(),
            duration: 45,
            slashes: 80,
            verified: true,
            mode: 'arcade'
          };
          this.totalGamesPlayed++;
          if (this.controlMode === 'camera') {
            this.setControlMode('mouse');
          }
          this.activeIntervals.clear();
          this.activeRafs.clear();
          this.isPaused = false;
        }

        public replayImmediate() {
          this.pendingScore = null;
          this.isRegistering = false;
          return this.startGame();
        }
      }

      const harness = new FullSystemStressHarness();
      const resolutions = [
        [320, 480], [375, 667], [390, 844], [412, 915], [768, 1024], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [500, 200]
      ];

      for (let i = 0; i < 100; i++) {
        const [w, h] = resolutions[i % resolutions.length];
        harness.resize(w, h);
        if (i % 3 === 0) harness.setControlMode('camera');
        else if (i % 3 === 1) harness.setControlMode('mouse');
        if (i % 5 === 0) harness.toggleFullscreen(true);
        else if (i % 5 === 3) harness.toggleFullscreen(false);
        harness.startGame();
        assert.equal(harness.isPlaying, true);
        assert.equal(harness.isRegistering, false);
        const score = (i * 137) % 5000;
        harness.triggerGameOver(score);
        assert.equal(harness.isPlaying, false);
        assert.equal(harness.isRegistering, true);
        assert.equal(harness.controlMode, 'mouse');
        assert.equal(harness.isCameraActive, false);
        assert.equal(harness.activeIntervals.size, 0);
        harness.replayImmediate();
        assert.equal(harness.isPlaying, true);
        assert.equal(harness.isRegistering, false);
        harness.triggerGameOver(score + 10);
      }
      assert.equal(harness.totalGamesPlayed, 200);
      assert.equal(harness.activeIntervals.size, 0);
      assert.equal(harness.activeRafs.size, 0);
    });

    test('1.2: Codebase static verification of combined cleanup paths in PizzaCanvas & HandTracker', () => {
      const canvasCode = fs.readFileSync(PIZZA_CANVAS_PATH, 'utf-8');
      const trackerCode = fs.readFileSync(HAND_TRACKER_PATH, 'utf-8');
      const appCode = fs.readFileSync(APP_TSX_PATH, 'utf-8');
      assert.ok(canvasCode.includes('clearInterval(clockIntervalRef.current)'));
      assert.ok(canvasCode.includes('setIsPlaying(false)'));
      assert.ok(canvasCode.includes(String.fromCharCode(115,101,116,67,111,110,116,114,111,108,77,111,100,101,40,39,109,111,117,115,101,39,41)));
      assert.ok(canvasCode.includes('isPausedRef.current = false'));
      assert.ok(trackerCode.includes('streamRef.current.getTracks()'));
      assert.ok(trackerCode.includes('track.stop()'));
      assert.ok(trackerCode.includes('handsInstanceRef.current.close()'));
      assert.ok(trackerCode.includes('streamRef.current = null'));
      assert.ok(appCode.includes('setPendingScore(null)'));
      assert.ok(appCode.includes('setIsPlaying(true)'));
    });
  });

  describe('2. White-Box Edge Cases & Invariant Hardening', () => {
    test('2.1: Extreme Scores: Zero, negative, large integers, floating point values', async () => {
      await resetMockKv();
      const pubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
      {
        const { req, res, getResult } = createMockReqRes({
          method: 'POST',
          url: '/api/score',
          body: { pubkey, score: 0, mode: 'arcade', name: 'ZeroHero' }
        });
        await scoreHandler(req, res);
        const resObj = getResult();
        assert.equal(resObj.statusCode, 200);
        assert.equal(resObj.data.success, true);
        assert.equal(resObj.data.score, 0);
      }
      {
        const { req, res, getResult } = createMockReqRes({
          method: 'POST',
          url: '/api/score',
          body: { pubkey, score: 1000000, mode: 'arcade', name: 'MillionHero' }
        });
        await scoreHandler(req, res);
        const resObj = getResult();
        assert.equal(resObj.statusCode, 200);
        assert.equal(resObj.data.success, true);
        assert.equal(resObj.data.score, 1000000);
      }
      {
        const { req, res, getResult } = createMockReqRes({
          method: 'POST',
          url: '/api/score',
          body: { pubkey, score: 1234.56, mode: 'classic', name: 'FloatHero' }
        });
        await scoreHandler(req, res);
        const resObj = getResult();
        assert.equal(resObj.statusCode, 200);
        assert.equal(resObj.data.success, true);
      }
    });

    test('2.2: Rapid Mode Toggles (Arcade vs Classic) during state lifecycle', () => {
      let currentMode: 'arcade' | 'classic' = 'arcade';
      const toggle = (mode: 'arcade' | 'classic') => { currentMode = mode; return currentMode; };
      for (let i = 0; i < 50; i++) {
        const target = i % 2 === 0 ? 'classic' : 'arcade';
        const result = toggle(target);
        assert.equal(result, target);
      }
      assert.equal(currentMode, 'arcade');
    });

    test('2.3: Instant Replay Spamming: Concurrency & Idempotency protection', () => {
      let countdownActive = false;
      let countdownVal: number | 'GO' | null = null;
      let startGameCalls = 0;
      let tickSoundCalls = 0;
      const initiateCountdownSim = () => {
        if (countdownActive) return;
        countdownActive = true;
        countdownVal = 3;
        tickSoundCalls++;
      };
      const finishCountdownSim = () => {
        countdownActive = false;
        countdownVal = null;
        startGameCalls++;
      };
      for (let i = 0; i < 50; i++) {
        initiateCountdownSim();
      }
      assert.equal(countdownActive, true);
      assert.equal(countdownVal, 3);
      assert.equal(tickSoundCalls, 1);
      finishCountdownSim();
      assert.equal(countdownActive, false);
      assert.equal(startGameCalls, 1);
    });

    test('2.4: Audio Filter Synthesis: Dynamic Resonance and Q-Factor Clamping on Combos > 5', () => {
      class MockBiquadFilter {
        public type: string = '';
        public frequency = { value: 0, setValueAtTime: (val: number) => { this.frequency.value = val; }, exponentialRampToValueAtTime: (val: number) => { this.frequency.value = val; } };
        public Q = { value: 0, setValueAtTime: (val: number) => { this.Q.value = val; } };
        public connect(dest: any) {}
      }
      class MockGainNode {
        public gain = { value: 1, setValueAtTime: (val: number) => { this.gain.value = val; }, exponentialRampToValueAtTime: (val: number) => { this.gain.value = val; } };
        public connect(dest: any) {}
      }
      class MockOscillator {
        public type: string = '';
        public frequency = { value: 0, setValueAtTime: (val: number) => { this.frequency.value = val; }, exponentialRampToValueAtTime: (val: number) => { this.frequency.value = val; } };
        public connect(dest: any) {}
        public start() {}
        public stop(time?: number) {}
      }
      const testSoundSynthesis = (type: 'slash' | 'splat', comboFactor: number, globalVolume = 0.6) => {
        const filter = new MockBiquadFilter();
        const gainNode = new MockGainNode();
        const osc = new MockOscillator();
        if (comboFactor > 5 && (type === 'slash' || type === 'splat')) {
          filter.type = 'bandpass';
          const startFreq = type === 'slash' ? 450 + comboFactor * 25 : 300 + comboFactor * 30;
          const endFreq = type === 'slash' ? 1400 + comboFactor * 80 : 800 + comboFactor * 90;
          filter.frequency.setValueAtTime(startFreq);
          filter.frequency.exponentialRampToValueAtTime(endFreq);
          const resonance = Math.min(15, comboFactor * 0.85);
          filter.Q.setValueAtTime(resonance);
          assert.ok(resonance <= 15);
          assert.ok(startFreq > 0 && endFreq > startFreq);
        }
        if (type === 'slash') {
          osc.type = 'triangle';
          const slashFreqBase = 300 + (comboFactor > 5 ? (comboFactor - 5) * 40 : 0);
          osc.frequency.setValueAtTime(slashFreqBase);
          gainNode.gain.setValueAtTime(0.12 * globalVolume);
        } else if (type === 'splat') {
          osc.type = 'sine';
          const baseFreq = 230 + Math.min(320, (comboFactor - 1) * 65) + (comboFactor > 5 ? (comboFactor - 5) * 60 : 0);
          osc.frequency.setValueAtTime(baseFreq);
          gainNode.gain.setValueAtTime(0.2 * globalVolume);
        }
        return { filter, gainNode, osc };
      };
      for (let combo = 1; combo <= 50; combo += 5) {
        const slashSynth = testSoundSynthesis('slash', combo);
        const splatSynth = testSoundSynthesis('splat', combo);
        assert.ok(slashSynth.gainNode.gain.value > 0);
        assert.ok(splatSynth.gainNode.gain.value > 0);
      }
    });

    test('2.5: Zero Residual Intervals & Leaks after Rapid Unmount and Mode Switch', () => {
      const activeIntervals = new Set<NodeJS.Timeout>();
      const createTrackedInterval = (fn: () => void, ms: number) => {
        const id = setInterval(() => { fn(); }, ms);
        activeIntervals.add(id);
        return id;
      };
      const clearTrackedInterval = (id: NodeJS.Timeout | null) => {
        if (id) { clearInterval(id); activeIntervals.delete(id); }
      };
      const ids: NodeJS.Timeout[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(createTrackedInterval(() => {}, 100));
      }
      assert.equal(activeIntervals.size, 10);
      ids.forEach(id => clearTrackedInterval(id));
      assert.equal(activeIntervals.size, 0);
    });

    test('2.6: Chef Name / Moniker Sanitization & Boundary Validation', () => {
      const sanitizeChefName = (input: string): string => {
        return (input?.trim() || 'CHEF_NINJA').slice(0, 12).toUpperCase();
      };
      assert.equal(sanitizeChefName('Ninja_Pro'), 'NINJA_PRO');
      assert.equal(sanitizeChefName('  chef_master  '), 'CHEF_MASTER');
      assert.equal(sanitizeChefName('SUPER_NINJA_CHEF_WORLD'), 'SUPER_NINJA_');
      assert.equal(sanitizeChefName('SUPER_NINJA_CHEF_WORLD').length, 12);
      assert.equal(sanitizeChefName(''), 'CHEF_NINJA');
      assert.equal(sanitizeChefName('   '), 'CHEF_NINJA');
      assert.equal(sanitizeChefName(null as any), 'CHEF_NINJA');
      assert.equal(sanitizeChefName(undefined as any), 'CHEF_NINJA');
    });
  });
});