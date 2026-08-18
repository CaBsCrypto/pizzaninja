import test from 'node:test';
import assert from 'node:assert/strict';
import { setupMockKvServer, resetMockKv } from '../helpers/mockKvServer.js';
import userHandler from '../../api/user.js';
import leaderboardHandler from '../../api/leaderboard.js';
import rankHandler from '../../api/leaderboard/rank.js';
import scoreHandler from '../../api/score.js';
import mintHandler from '../../api/mint.js';
import mintNftHandler from '../../api/mint_nft.js';

let serverObj: any;

test.before(async () => {
  serverObj = await setupMockKvServer();
});

test.after(async () => {
  if (serverObj && serverObj.server) {
    serverObj.server.close();
  }
});

test.beforeEach(async () => {
  await resetMockKv();
});

// Helper to construct mock Request & Response objects for handlers
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

test('Verification 1: Validate Example Stellar Pubkey in docs/API_REFERENCE.md', async () => {
  const docPubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;
  const isValid = STELLAR_PUBKEY_REGEX.test(docPubkey);
  console.log(`Doc Pubkey: "${docPubkey}", length: ${docPubkey.length}, isValid regex: ${isValid}`);
  assert.equal(isValid, true, 'Example pubkey in API_REFERENCE.md must pass STELLAR_PUBKEY_REGEX');
});

test('Verification 2: Execute POST /api/user documented example', async () => {
  const payload = {
    pubkey: 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L',
    username: 'Ninja_Chef',
    avatar: 'ninja_avatar_1.png',
    privyDid: 'did:privy:cm7x89q0z00003b6t12345678'
  };

  const { req, res, getResult } = createMockReqRes({
    method: 'POST',
    url: '/api/user',
    body: payload
  });

  const response = await userHandler(req, res);
  const result = getResult();

  assert.equal(result.statusCode, 201, 'POST /api/user example should return 201');
  assert.equal(result.data.success, true);
  assert.equal(result.data.user.pubkey, payload.pubkey);
  assert.equal(result.data.user.username, payload.username);
  assert.equal(result.data.user.avatar, payload.avatar);
  assert.equal(result.data.user.privyDid, payload.privyDid);
  assert.ok(result.data.user.createdAt);
  assert.ok(result.data.user.updatedAt);
});

test('Verification 3: Error schemas for POST /api/user (400, 409)', async () => {
  // 400 Bad Request - Invalid pubkey
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/user',
      body: { pubkey: 'INVALID_PUBKEY', username: 'Ninja_Chef' }
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.ok(typeof result.data.error === 'string');
  }

  // 400 Bad Request - Invalid username
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/user',
      body: { pubkey: 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L', username: 'a!' }
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Invalid username format. Must be 3-15 alphanumeric characters or underscores.');
  }

  // 409 Conflict - Username taken
  {
    // Register user 1
    const { req: req1, res: res1 } = createMockReqRes({
      method: 'POST',
      url: '/api/user',
      body: { pubkey: 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L', username: 'Ninja_Chef' }
    });
    await userHandler(req1, res1);

    // Register user 2 with same username
    const { req: req2, res: res2, getResult: getResult2 } = createMockReqRes({
      method: 'POST',
      url: '/api/user',
      body: { pubkey: 'GBYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5M', username: 'ninja_chef' }
    });
    await userHandler(req2, res2);
    const result2 = getResult2();
    assert.equal(result2.statusCode, 409);
    assert.equal(result2.data.success, false);
    assert.equal(result2.data.error, 'Username already taken');
  }
});

test('Verification 4: Execute GET /api/user documented example & error schemas (400, 404)', async () => {
  // First register user
  const pubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const username = 'Ninja_Chef';
  const { req: reqReg, res: resReg } = createMockReqRes({
    method: 'POST',
    url: '/api/user',
    body: { pubkey, username, avatar: 'ninja_avatar_1.png' }
  });
  await userHandler(reqReg, resReg);

  // 200 OK by username
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: `/api/user?username=${username}`,
      query: { username }
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.user.username, username);
    assert.ok(result.data.stats);
  }

  // 200 OK by pubkey
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: `/api/user?pubkey=${pubkey}`,
      query: { pubkey }
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.user.pubkey, pubkey);
  }

  // 400 Bad Request - missing parameters
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/user',
      query: {}
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Missing pubkey or username parameter');
  }

  // 404 Not Found
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/user?username=nonexist_user',
      query: { username: 'nonexist_user' }
    });
    await userHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 404);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'User not found');
  }
});

test('Verification 5: Execute GET /api/leaderboard documented example & error schemas (400)', async () => {
  // Submit a score to populate leaderboard
  const pubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const { req: reqScore, res: resScore } = createMockReqRes({
    method: 'POST',
    url: '/api/score',
    body: { pubkey, score: 1250, mode: 'arcade', name: 'Ninja_Chef' }
  });
  await scoreHandler(reqScore, resScore);

  // 200 OK
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/leaderboard?mode=arcade&timeframe=weekly&limit=10&page=1',
      query: { mode: 'arcade', timeframe: 'weekly', limit: '10', page: '1' }
    });
    await leaderboardHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.mode, 'arcade');
    assert.equal(result.data.timeframe, 'weekly');
    assert.ok(Array.isArray(result.data.players));
  }

  // 400 Bad Request - Invalid mode
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/leaderboard?mode=survival',
      query: { mode: 'survival' }
    });
    await leaderboardHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Invalid mode parameter. Allowed values: arcade, classic');
  }

  // 400 Bad Request - Invalid limit
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/leaderboard?limit=150',
      query: { limit: '150' }
    });
    await leaderboardHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Invalid limit parameter. Must be an integer between 1 and 100.');
  }
});

test('Verification 6: Execute GET /api/leaderboard/rank documented example & error schemas (400, 404)', async () => {
  const pubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const username = 'Ninja_Chef';

  // Register user & post score
  const { req: reqReg, res: resReg } = createMockReqRes({
    method: 'POST',
    url: '/api/user',
    body: { pubkey, username }
  });
  await userHandler(reqReg, resReg);

  const { req: reqScore, res: resScore } = createMockReqRes({
    method: 'POST',
    url: '/api/score',
    body: { pubkey, score: 1250, mode: 'arcade', name: username }
  });
  await scoreHandler(reqScore, resScore);

  // 200 OK
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: `/api/leaderboard/rank?username=${username}&mode=arcade&timeframe=alltime`,
      query: { username, mode: 'arcade', timeframe: 'alltime' }
    });
    await rankHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.rank, 1);
    assert.equal(result.data.score, 1250);
  }

  // 400 Bad Request
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/leaderboard/rank',
      query: {}
    });
    await rankHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Missing pubkey or username parameter');
  }

  // 404 Not Found
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/leaderboard/rank?username=nonexist_player',
      query: { username: 'nonexist_player' }
    });
    await rankHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 404);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'User not found');
  }
});

test('Verification 7: Execute POST /api/score documented example & error schemas (400, 405)', async () => {
  const pubkey = 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';

  // 200 OK
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/score',
      body: { pubkey, name: 'Ninja_Chef', score: 1250, mode: 'arcade' }
    });
    await scoreHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.score, 1250);
    assert.equal(result.data.mode, 'arcade');
    assert.ok(result.data.txHash);
  }

  // 400 Bad Request - missing score & identity
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/score',
      body: {}
    });
    await scoreHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Missing identity or score');
  }

  // 405 Method Not Allowed
  {
    const { req, res, getResult } = createMockReqRes({
      method: 'PUT',
      url: '/api/score',
      body: {}
    });
    await scoreHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 405);
    assert.equal(result.data.success, false);
    assert.equal(result.data.error, 'Method Not Allowed');
  }
});

test('Verification 8: Soroban Mint endpoints input validation & error schemas (400, 405, 500)', async () => {
  const mockReq = (method: string, body: any) => new Request('http://localhost/api/mint', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  // /api/mint 400 Invalid playerAddress
  {
    const res = await mintHandler(mockReq('POST', { playerAddress: 'INVALID', score: 100 }));
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Invalid playerAddress');
  }

  // /api/mint 400 Invalid score
  {
    const res = await mintHandler(mockReq('POST', { playerAddress: 'GAYK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L', score: -10 }));
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Invalid score');
  }

  // /api/mint 405 Method Not Allowed
  {
    const res = await mintHandler(mockReq('PUT', {}));
    const data = await res.json();
    assert.equal(res.status, 405);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Method Not Allowed');
  }

  // /api/mint_nft 400 Invalid playerAddress
  {
    const reqNft = new Request('http://localhost/api/mint_nft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerAddress: 'SHORT_KEY' })
    });
    const res = await mintNftHandler(reqNft);
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Invalid playerAddress');
  }

  // /api/mint_nft 405 Method Not Allowed
  {
    const reqNft = new Request('http://localhost/api/mint_nft', { method: 'DELETE' });
    const res = await mintNftHandler(reqNft);
    const data = await res.json();
    assert.equal(res.status, 405);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Method Not Allowed');
  }
});
