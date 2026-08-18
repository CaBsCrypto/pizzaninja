import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from './helpers/testServer.js';

describe('Empirical M3 Stress & Edge Case Verification', () => {
  let server: TestServer;
  let baseUrl: string;

  const PUBKEY_1 = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const PUBKEY_2 = 'GBYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5M';
  const UNREGISTERED_PUBKEY = 'GCYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5N';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  describe('1. Score Sync (api/score.ts) Empirical Stress Tests', () => {
    test('1.1 Missing pubkey and missing identity validation', async () => {
      // No identity or score
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(res.status, 400);
      let data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.error, /Missing identity or score/i);

      // Score provided but no pubkey or name
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 100 })
      });
      assert.equal(res.status, 400);

      // Empty string pubkey and no name
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 100, pubkey: '' })
      });
      assert.equal(res.status, 400);

      // Name provided without pubkey (Guest)
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 150, name: 'GuestNinja' })
      });
      assert.equal(res.status, 200);
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.score, 150);
    });

    test('1.2 Invalid score format validation', async () => {
      // Non-numeric score string
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 'not_a_number', pubkey: PUBKEY_1 })
      });
      assert.equal(res.status, 400);
      let data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.error, /Invalid score value/i);

      // Null score
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: null, pubkey: PUBKEY_1 })
      });
      assert.equal(res.status, 400);
    });

    test('1.3 Zero and negative score submission on fresh user', async () => {
      // Submit score = 0 for fresh pubkey
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.score, 0);
      assert.equal(data.updated, true);

      // Submit score = -25 for PUBKEY_2
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -25, pubkey: PUBKEY_2, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.score, -25);
      assert.equal(data.updated, true);
    });

    test('1.4 High score updating logic (higher score updates, lower score does not decrease all-time high score)', async () => {
      // Register PUBKEY_1
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_1, username: 'HighScoreNinja' })
      });

      // Submit high score 500
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 500, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, true);
      assert.equal(data.score, 500);

      // Submit lower score 200 -> should NOT downgrade personal best
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 200, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, false);
      assert.equal(data.score, 200); // return requested score payload

      // Verify GET /api/user still reports arcadeScore = 500
      let userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_1}`);
      let userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 500);

      // Submit score 0 -> should NOT downgrade personal best
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, false);

      userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_1}`);
      userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 500);

      // Submit negative score -50 -> should NOT downgrade personal best
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -50, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, false);

      userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_1}`);
      userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 500);

      // Submit higher score 1000 -> SHOULD update personal best
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1000, pubkey: PUBKEY_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, true);

      userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_1}`);
      userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 1000);
    });

    test('1.5 Non-existent / unregistered user score submission', async () => {
      // Score submission for unregistered pubkey
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 750, pubkey: UNREGISTERED_PUBKEY, mode: 'classic' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, true);
      assert.equal(data.score, 750);
      assert.equal(data.mode, 'classic');

      // Now register the user
      const regRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: UNREGISTERED_PUBKEY, username: 'LateRegistrant' })
      });
      assert.equal(regRes.status, 201);

      // Fetch user profile - stats should reflect the submitted classic score 750 from ZSET
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${UNREGISTERED_PUBKEY}`);
      const userData = await userRes.json();
      assert.equal(userData.stats.classicScore, 750);
    });

    test('1.6 Invalid and fallback mode formats', async () => {
      // Mode 'invalid_mode' -> defaults to 'arcade'
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 350, pubkey: PUBKEY_2, mode: 'invalid_mode' })
      });
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.mode, 'arcade');

      // Mode null -> defaults to 'arcade'
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 360, pubkey: PUBKEY_2, mode: null })
      });
      assert.equal(res.status, 200);
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.mode, 'arcade');

      // Mode 'classic' -> uses 'classic'
      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 400, pubkey: PUBKEY_2, mode: 'classic' })
      });
      assert.equal(res.status, 200);
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.mode, 'classic');
    });
  });
});
