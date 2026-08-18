import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';
import { kv } from '@vercel/kv';

describe('Milestone 3 Challenger Deep Stress & Edge Case Harness', () => {
  let server: TestServer;
  let baseUrl: string;

  const PUBKEY_A = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const PUBKEY_B = 'GBYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5M';
  const PUBKEY_UNREG = 'GCYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5N';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  describe('1. Negative, Zero, and Boundary Scores in api/score.ts', () => {
    test('1.1 Score = 0 for new user initializes high score to 0', async () => {
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_A, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.score, 0);
      assert.equal(data.updated, true);
    });

    test('1.2 Score = 0 for existing higher score user returns updated: false', async () => {
      // First raise score to 500
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 500, pubkey: PUBKEY_A, mode: 'arcade' })
      });

      // Submit score = 0
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_A, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, false);
      assert.equal(data.score, 0);

      // Verify ZSET score remains 500
      const client = kv as any;
      const currentScore = await client.zscore('slashslice:leaderboard:arcade:alltime', PUBKEY_A);
      assert.equal(Number(currentScore), 500);
    });

    test('1.3 Negative score progression (-50 -> -10 -> -30 -> 0)', async () => {
      // User B starts with -50
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -50, pubkey: PUBKEY_B, mode: 'arcade' })
      });
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, true);
      assert.equal(data.score, -50);

      // Submit -10 (higher than -50) -> should update
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -10, pubkey: PUBKEY_B, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, true);
      assert.equal(data.score, -10);

      // Submit -30 (lower than -10) -> should NOT update
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -30, pubkey: PUBKEY_B, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, false);
      assert.equal(data.score, -30);

      // Submit 0 (higher than -10) -> should update
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_B, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, true);
      assert.equal(data.score, 0);
    });

    test('1.4 String scores and invalid numeric inputs', async () => {
      // String numeric score "1250"
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: '1250', pubkey: PUBKEY_A, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.score, 1250);
      assert.equal(data.updated, true);

      // Non-numeric score string "invalid"
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 'invalid', pubkey: PUBKEY_A })
      });
      assert.equal(res.status, 400);
      data = await res.json();
      assert.equal(data.success, false);

      // Score is object/array
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: { val: 100 }, pubkey: PUBKEY_A })
      });
      assert.equal(res.status, 400);
    });
  });

  describe('2. Missing Pubkeys & Guest Submissions', () => {
    test('2.1 Rejects when neither pubkey nor name is provided', async () => {
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 999 })
      });
      assert.equal(res.status, 400);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 999, pubkey: '', name: '' })
      });
      assert.equal(res.status, 400);
    });

    test('2.2 Accepts guest submission with name only', async () => {
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 450, name: 'AnonymousSlicer', mode: 'classic' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.mode, 'classic');

      const client = kv as any;
      const score = await client.zscore('slashslice:leaderboard:classic:alltime', 'AnonymousSlicer');
      assert.equal(Number(score), 450);
    });
  });

  describe('3. Non-Existent Users & Delayed Profile Registration', () => {
    test('3.1 Unregistered user scores in ZSET and syncs when profile created', async () => {
      // 1. Submit score before user profile is registered
      const scoreRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 3200, pubkey: PUBKEY_UNREG, mode: 'arcade' })
      });
      assert.equal(scoreRes.status, 200);

      // 2. Querying user before registration returns 404 (StellarHub shows register form)
      const preUserRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_UNREG}`);
      assert.equal(preUserRes.status, 404);

      // 3. User registers profile
      const regRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_UNREG, username: 'DelayedNinja', avatar: 'chef_pizza' })
      });
      assert.equal(regRes.status, 201);

      // 4. Querying user after registration returns profile + arcadeScore 3200 from ZSET
      const postUserRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_UNREG}`);
      assert.equal(postUserRes.status, 200);
      const postUserData = await postUserRes.json();
      assert.equal(postUserData.user.username, 'DelayedNinja');
      assert.equal(postUserData.stats.arcadeScore, 3200);
    });
  });

  describe('4. Invalid Mode Formats', () => {
    test('4.1 Unknown mode formats fallback to arcade mode', async () => {
      const modesToTest = ['custom_mode', 'ARCADE', '', null, undefined];
      for (const m of modesToTest) {
        const res = await fetch(`${baseUrl}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: 100, pubkey: PUBKEY_A, mode: m })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.mode, 'arcade');
      }
    });

    test('4.2 Exact string "classic" matches classic mode', async () => {
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 100, pubkey: PUBKEY_A, mode: 'classic' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.mode, 'classic');
    });
  });

  describe('5. High Score Equality & Updating Logic', () => {
    test('5.1 Equal score submission returns updated: false and retains rank', async () => {
      // Score 1250 already submitted in 1.4 for PUBKEY_A
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1250, pubkey: PUBKEY_A, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.updated, false);
      assert.equal(data.score, 1250);
    });

    test('5.2 Submitting new higher score updates updated: true and updates profile', async () => {
      // Register PUBKEY_A first
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_A, username: 'RegisteredA' })
      });

      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 9999, pubkey: PUBKEY_A, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.updated, true);
      assert.equal(data.score, 9999);

      // Verify user profile stats
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_A}`);
      assert.equal(userRes.status, 200);
      const userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 9999);
    });
  });

  describe('6. StellarHub Integration API Contracts', () => {
    test('6.1 GET /api/user returns proper contract structure expected by StellarHub', async () => {
      const res = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_A}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.user);
      assert.ok(data.stats);
      assert.equal(typeof data.stats.arcadeScore, 'number');
      assert.equal(typeof data.stats.classicScore, 'number');
      assert.ok('globalRank' in data.stats);
    });

    test('6.2 POST /api/user username validation matches StellarHub requirements', async () => {
      const VALID_PUBKEY_OTHER = 'GDYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5O';

      // Username too short (2 chars)
      let res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: VALID_PUBKEY_OTHER, username: 'ab' })
      });
      assert.equal(res.status, 400);

      // Username too long (16 chars)
      res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: VALID_PUBKEY_OTHER, username: 'abcdefghijklmnop' })
      });
      assert.equal(res.status, 400);

      // Username with invalid characters
      res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: VALID_PUBKEY_OTHER, username: 'ninja@slice' })
      });
      assert.equal(res.status, 400);

      // Username collision (PUBKEY_UNREG has username 'DelayedNinja')
      res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: VALID_PUBKEY_OTHER, username: 'delayedninja' })
      });
      assert.equal(res.status, 409);
    });
  });
});
