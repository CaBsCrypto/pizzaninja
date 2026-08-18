import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';

describe('Tier 4: Real-World Multi-User Competition Scenarios', () => {
  let server: TestServer;
  let baseUrl: string;

  // 10 Valid Stellar ED25519 Public Keys for 10 Competitors
  const PLAYERS = [
    { pubkey: 'GAA22222222222222222222222222222222222222222222222222222', username: 'Player_Alpha', arcadeScore: 4500, classicScore: 1200 },
    { pubkey: 'GAB33333333333333333333333333333333333333333333333333333', username: 'Player_Bravo', arcadeScore: 3200, classicScore: 4800 },
    { pubkey: 'GAC44444444444444444444444444444444444444444444444444444', username: 'Player_Charlie', arcadeScore: 5000, classicScore: 2100 },
    { pubkey: 'GAD55555555555555555555555555555555555555555555555555555', username: 'Player_Delta', arcadeScore: 1800, classicScore: 3900 },
    { pubkey: 'GAE66666666666666666666666666666666666666666666666666666', username: 'Player_Echo', arcadeScore: 2900, classicScore: 5200 },
    { pubkey: 'GAF77777777777777777777777777777777777777777777777777777', username: 'Player_Foxtrot', arcadeScore: 4100, classicScore: 1500 },
    { pubkey: 'GAG22222222222222222222222222222222222222222222222222222', username: 'Player_Golf', arcadeScore: 2200, classicScore: 2800 },
    { pubkey: 'GAH33333333333333333333333333333333333333333333333333333', username: 'Player_Hotel', arcadeScore: 3700, classicScore: 4300 },
    { pubkey: 'GAI44444444444444444444444444444444444444444444444444444', username: 'Player_India', arcadeScore: 1100, classicScore: 3100 },
    { pubkey: 'GAJ55555555555555555555555555555555555555555555555555555', username: 'Player_Juliet', arcadeScore: 4800, classicScore: 1900 }
  ];

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  test('Tier 4: Setup 10 Users and Submit Arcade & Classic Scores', async () => {
    for (const player of PLAYERS) {
      // Register user
      const regRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: player.pubkey,
          username: player.username,
          avatar: `avatar_${player.username}.png`
        })
      });
      assert.equal(regRes.status === 201 || regRes.status === 200, true, `Failed to register ${player.username}`);

      // Submit arcade score
      const arcadeRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: player.pubkey,
          name: player.username,
          score: player.arcadeScore,
          mode: 'arcade'
        })
      });
      assert.equal(arcadeRes.status, 200);

      // Submit classic score
      const classicRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: player.pubkey,
          name: player.username,
          score: player.classicScore,
          mode: 'classic'
        })
      });
      assert.equal(classicRes.status, 200);
    }
  });

  test('Tier 4: Verify Arcade Leaderboard Ranking & Sorting Order', async () => {
    const res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime&limit=20`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 10);
    assert.equal(data.entries.length, 10);

    // #1 should be Player_Charlie with 5000 points
    assert.equal(data.entries[0].pubkey, PLAYERS[2].pubkey);
    assert.equal(data.entries[0].username, 'Player_Charlie');
    assert.equal(data.entries[0].score, 5000);
    assert.equal(data.entries[0].rank, 1);

    // #2 should be Player_Juliet with 4800 points
    assert.equal(data.entries[1].username, 'Player_Juliet');
    assert.equal(data.entries[1].score, 4800);
    assert.equal(data.entries[1].rank, 2);

    // #10 should be Player_India with 1100 points
    assert.equal(data.entries[9].username, 'Player_India');
    assert.equal(data.entries[9].score, 1100);
    assert.equal(data.entries[9].rank, 10);
  });

  test('Tier 4: Verify Classic Leaderboard Independent Ranking & Sorting', async () => {
    const res = await fetch(`${baseUrl}/api/leaderboard?mode=classic&timeframe=alltime&limit=20`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 10);

    // #1 in Classic should be Player_Echo with 5200 points
    assert.equal(data.entries[0].username, 'Player_Echo');
    assert.equal(data.entries[0].score, 5200);
    assert.equal(data.entries[0].rank, 1);

    // #2 in Classic should be Player_Bravo with 4800 points
    assert.equal(data.entries[1].username, 'Player_Bravo');
    assert.equal(data.entries[1].score, 4800);
    assert.equal(data.entries[1].rank, 2);
  });

  test('Tier 4: Verify Multi-Page Leaderboard Pagination across 10 Competitors', async () => {
    // Page 1 (limit 3) -> Ranks 1 to 3
    const p1Res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&limit=3&page=1`);
    const p1 = await p1Res.json();
    assert.equal(p1.total, 10);
    assert.equal(p1.totalPages, 4);
    assert.equal(p1.entries.length, 3);
    assert.equal(p1.entries[0].rank, 1);
    assert.equal(p1.entries[2].rank, 3);

    // Page 2 (limit 3) -> Ranks 4 to 6
    const p2Res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&limit=3&page=2`);
    const p2 = await p2Res.json();
    assert.equal(p2.entries.length, 3);
    assert.equal(p2.entries[0].rank, 4);
    assert.equal(p2.entries[2].rank, 6);

    // Page 4 (limit 3) -> Rank 10 (1 entry left)
    const p4Res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&limit=3&page=4`);
    const p4 = await p4Res.json();
    assert.equal(p4.entries.length, 1);
    assert.equal(p4.entries[0].rank, 10);
  });

  test('Tier 4: Verify Dynamic Rank & Percentile Recalculation on Score Overtake', async () => {
    // Initially Player_Delta is rank #9 in Arcade with 1800 points
    const beforeRankRes = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${PLAYERS[3].pubkey}&mode=arcade`);
    const beforeRank = await beforeRankRes.json();
    assert.equal(beforeRank.rank, 9);
    assert.equal(beforeRank.topPercentile, 90);

    // Player_Delta submits a mega score of 6000 points, overtaking Player_Charlie (#1)
    const newScoreRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: PLAYERS[3].pubkey,
        name: PLAYERS[3].username,
        score: 6000,
        mode: 'arcade'
      })
    });
    assert.equal(newScoreRes.status, 200);

    // Player_Delta is now #1, top 10%
    const afterRankRes = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${PLAYERS[3].pubkey}&mode=arcade`);
    const afterRank = await afterRankRes.json();
    assert.equal(afterRank.score, 6000);
    assert.equal(afterRank.rank, 1);
    assert.equal(afterRank.topPercentile, 10);

    // Player_Charlie is now #2
    const charlieRankRes = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${PLAYERS[2].pubkey}&mode=arcade`);
    const charlieRank = await charlieRankRes.json();
    assert.equal(charlieRank.rank, 2);
    assert.equal(charlieRank.topPercentile, 20);
  });
});
