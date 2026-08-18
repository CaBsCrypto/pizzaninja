import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';
import { kv } from '@vercel/kv';

describe('Milestone 3 Generation 2 Empirical Stress & Boundary Suite', () => {
  let server: TestServer;
  let baseUrl: string;

  const PUBKEY_STRESS_1 = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const PUBKEY_STRESS_2 = 'GBYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5M';
  const PUBKEY_STRESS_3 = 'GCYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5N';
  const PUBKEY_STRESS_4 = 'GDYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5O';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  describe('1. Zero & Negative Score Boundary Stress', () => {
    test('1.1 Zero score handles correctly for new and existing users', async () => {
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_STRESS_1, mode: 'arcade' })
      });
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.score, 0);
      assert.equal(data.updated, true);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 50, pubkey: PUBKEY_STRESS_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, true);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, pubkey: PUBKEY_STRESS_1, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, false);
    });

    test('1.2 Negative score boundaries and progression', async () => {
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -100, pubkey: PUBKEY_STRESS_2, mode: 'classic' })
      });
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.success, true);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -50, pubkey: PUBKEY_STRESS_2, mode: 'classic' })
      });
      data = await res.json();
      assert.equal(data.updated, true);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -80, pubkey: PUBKEY_STRESS_2, mode: 'classic' })
      });
      data = await res.json();
      assert.equal(data.updated, false);
    });
  });

  describe('2. Missing Fields & Input Sanitization', () => {
    test('2.1 Rejects empty or missing body in score submission', async () => {
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ''
      });
      assert.equal(res.status, 400);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(res.status, 400);
    });

    test('2.2 Rejects non-numeric or missing score values', async () => {
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_STRESS_3 })
      });
      assert.equal(res.status, 400);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 'abc', pubkey: PUBKEY_STRESS_3 })
      });
      assert.equal(res.status, 400);
    });
  });

  describe('3. Invalid Pubkey Format Validation', () => {
    test('3.1 Rejects invalid Stellar pubkeys across user and rank APIs', async () => {
      const invalidPubkeys = [
        'INVALID_PUBKEY',
        'G123456789012345678901234567890123456789012345678901234',
        'GSHORTKEY',
        'AYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L',
        'G' + 'A'.repeat(56)
      ];

      for (const pk of invalidPubkeys) {
        let res = await fetch(`${baseUrl}/api/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkey: pk, username: 'valid_user' })
        });
        assert.equal(res.status, 400);

        res = await fetch(`${baseUrl}/api/user?pubkey=${pk}`);
        assert.equal(res.status, 400);

        res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${pk}`);
        assert.equal(res.status, 400);
      }
    });
  });

  describe('4. Guest User Submissions & Leaderboard Name Handling Findings', () => {
    test('4.1 Guest submission name is discarded or replaced with Anonymous in GET /api/leaderboard', async () => {
      const guestName = 'GuestHero';
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 2200, name: guestName, mode: 'arcade' })
      });
      assert.equal(res.status, 200);

      const lbRes = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime`);
      assert.equal(lbRes.status, 200);
      const lbData = await lbRes.json();
      
      const guestEntry = lbData.players.find((p: any) => p.pubkey === guestName);
      assert.ok(guestEntry, 'Guest entry found in leaderboard players list');
      
      // EMPIRICAL BUG CONFIRMED: username displays 'Anonymous' instead of submitted guest name 'GuestHero'
      assert.equal(guestEntry.username, 'Anonymous', 'Guest name is overwritten with Anonymous in leaderboard display');
    });

    test('4.2 Guest score update preserves high score for same name', async () => {
      const guestName = 'GuestHero';
      let res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 500, name: guestName, mode: 'arcade' })
      });
      let data = await res.json();
      assert.equal(data.updated, false);

      res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 3500, name: guestName, mode: 'arcade' })
      });
      data = await res.json();
      assert.equal(data.updated, true);
      assert.equal(data.score, 3500);
    });
  });

  describe('5. Concurrency Race Condition Findings', () => {
    test('5.1 Concurrent score submissions race condition (Read-then-write non-atomic ZADD)', async () => {
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1000, pubkey: PUBKEY_STRESS_4, mode: 'arcade' })
      });

      const promises = [1500, 800].map(s => 
        fetch(`${baseUrl}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: s, pubkey: PUBKEY_STRESS_4, mode: 'arcade' })
        })
      );

      const responses = await Promise.all(promises);
      for (const r of responses) {
        assert.equal(r.status, 200);
      }

      const client = kv as any;
      const zscore = await client.zscore('slashslice:leaderboard:arcade:alltime', PUBKEY_STRESS_4);
      assert.ok(Number(zscore) === 1500 || Number(zscore) === 800, 'Recorded score must be 1500 or 800');
    });
  });
});
