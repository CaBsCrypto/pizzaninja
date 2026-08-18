import { kv } from '@vercel/kv';

const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,15}$/;

export function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekStr = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${d.getUTCFullYear()}-W${weekStr}`;
}

export function getUTCDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function decodeBase64Member(val: any): string {
  if (val === null || val === undefined) return '';

  if (Buffer.isBuffer(val)) {
    const str = val.toString('base64');
    if (STELLAR_PUBKEY_REGEX.test(str) || USERNAME_REGEX.test(str)) return str;
    const utf8 = val.toString('utf8');
    if (STELLAR_PUBKEY_REGEX.test(utf8) || USERNAME_REGEX.test(utf8)) return utf8;
    return str;
  }

  if (val instanceof Uint8Array) {
    const buf = Buffer.from(val);
    const str = buf.toString('base64');
    if (STELLAR_PUBKEY_REGEX.test(str) || USERNAME_REGEX.test(str)) return str;
    const utf8 = buf.toString('utf8');
    if (STELLAR_PUBKEY_REGEX.test(utf8) || USERNAME_REGEX.test(utf8)) return utf8;
    return str;
  }

  if (typeof val === 'object' && val !== null) {
    if (val.type === 'Buffer' && Array.isArray(val.data)) {
      const buf = Buffer.from(val.data);
      const str = buf.toString('base64');
      if (STELLAR_PUBKEY_REGEX.test(str) || USERNAME_REGEX.test(str)) return str;
      const utf8 = buf.toString('utf8');
      if (STELLAR_PUBKEY_REGEX.test(utf8) || USERNAME_REGEX.test(utf8)) return utf8;
      return str;
    }
  }

  if (typeof val === 'string') {
    let cleaned = val.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'string') cleaned = parsed;
      } catch (e) {
        cleaned = cleaned.slice(1, -1);
      }
    }

    if (STELLAR_PUBKEY_REGEX.test(cleaned) || USERNAME_REGEX.test(cleaned)) {
      return cleaned;
    }

    try {
      const restored = Buffer.from(cleaned, 'latin1').toString('base64');
      if (STELLAR_PUBKEY_REGEX.test(restored) || USERNAME_REGEX.test(restored)) {
        return restored;
      }
    } catch (e) {}

    try {
      const restoredBinary = Buffer.from(cleaned, 'binary').toString('base64');
      if (STELLAR_PUBKEY_REGEX.test(restoredBinary) || USERNAME_REGEX.test(restoredBinary)) {
        return restoredBinary;
      }
    } catch (e) {}

    return cleaned;
  }

  return String(val);
}

export function cleanPubkey(pubkey: any): string {
  return decodeBase64Member(pubkey);
}

export function cleanUsername(username: any): string {
  return decodeBase64Member(username);
}

export default async function handler(req: any, res?: any) {
  // CORS setup
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';

  if (method === 'OPTIONS') {
    if (res && typeof res.status === 'function') {
      return res.status(200).end();
    }
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      }
    });
  }

  if (method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  const client = kv as any;

  try {
    let query = req.query;
    if (!query && req.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        query = Object.fromEntries(urlObj.searchParams.entries());
      } catch (e) {
        query = {};
      }
    }
    query = query || {};

    const { pubkey, username } = query;
    const mode = query.mode || 'arcade';
    const timeframe = query.timeframe || 'alltime';

    // Validate parameter presence
    if (!pubkey && !username) {
      return sendJson(res, 400, { success: false, error: 'Missing pubkey or username parameter' });
    }

    // Validate mode parameter
    if (mode !== 'arcade' && mode !== 'classic') {
      return sendJson(res, 400, { success: false, error: 'Invalid mode parameter. Allowed values: arcade, classic' });
    }

    // Validate timeframe parameter
    if (timeframe !== 'alltime' && timeframe !== 'weekly' && timeframe !== 'daily') {
      return sendJson(res, 400, { success: false, error: 'Invalid timeframe parameter. Allowed values: alltime, weekly, daily' });
    }

    let targetPubkey = pubkey;

    if (targetPubkey) {
      targetPubkey = cleanPubkey(targetPubkey);
      if (typeof targetPubkey !== 'string' || !STELLAR_PUBKEY_REGEX.test(targetPubkey)) {
        return sendJson(res, 400, { success: false, error: 'Invalid Stellar public key format' });
      }
    } else if (username) {
      if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
        return sendJson(res, 400, { success: false, error: 'Invalid username format' });
      }
      const normalizedUsername = username.toLowerCase();
      targetPubkey = await client.get(`slashslice:username:${normalizedUsername}`);
      if (!targetPubkey) {
        return sendJson(res, 404, { success: false, error: 'User not found' });
      }
      targetPubkey = cleanPubkey(targetPubkey);
    }

    // Construct Redis ZSET key
    const genericKey = `slashslice:leaderboard:${mode}:${timeframe}`;
    let dynamicKey = genericKey;
    if (timeframe === 'weekly') {
      dynamicKey = `slashslice:leaderboard:${mode}:weekly:${getISOWeekString()}`;
    } else if (timeframe === 'daily') {
      dynamicKey = `slashslice:leaderboard:${mode}:daily:${getUTCDateString()}`;
    }

    let keyToUse = dynamicKey;
    let score = await client.zscore(dynamicKey, targetPubkey);
    if ((score === null || score === undefined) && dynamicKey !== genericKey) {
      score = await client.zscore(genericKey, targetPubkey);
      if (score !== null && score !== undefined) {
        keyToUse = genericKey;
      }
    }

    if ((score === null || score === undefined)) {
      const jsonPubkey = JSON.stringify(targetPubkey);
      score = await client.zscore(dynamicKey, jsonPubkey);
      if (score !== null && score !== undefined) {
        keyToUse = dynamicKey;
      } else if (dynamicKey !== genericKey) {
        score = await client.zscore(genericKey, jsonPubkey);
        if (score !== null && score !== undefined) {
          keyToUse = genericKey;
        }
      }
    }

    if (score === null || score === undefined) {
      return sendJson(res, 404, { success: false, error: 'Player not found on specified leaderboard' });
    }

    let zrevrank = await client.zrevrank(keyToUse, targetPubkey);
    if (zrevrank === null || zrevrank === undefined) {
      zrevrank = await client.zrevrank(keyToUse, JSON.stringify(targetPubkey));
    }

    const total = await client.zcard(keyToUse);

    const rank = (zrevrank !== null && zrevrank !== undefined) ? Number(zrevrank) + 1 : 0;

    const percentile = (total > 0 && rank > 0)
      ? Number((((total - rank + 1) / total) * 100).toFixed(2))
      : 0;

    const topPercentage = (total > 0 && rank > 0)
      ? Number(((rank / total) * 100).toFixed(2))
      : 0;

    // Fetch user profile metadata from slashslice:user:<targetPubkey>
    let userProfileRaw = await client.get(`slashslice:user:${targetPubkey}`);
    if (!userProfileRaw) {
      userProfileRaw = await client.hgetall(`slashslice:user:${targetPubkey}`);
    }

    let userObj: any = {};
    if (userProfileRaw) {
      if (typeof userProfileRaw === 'string') {
        try {
          userObj = JSON.parse(userProfileRaw);
        } catch (e) {}
      } else if (typeof userProfileRaw === 'object') {
        userObj = userProfileRaw;
      }
    }

    const resolvedUsername = cleanUsername(userObj.username) || (username ? String(username) : (targetPubkey.length > 10 ? `${targetPubkey.slice(0, 4)}...${targetPubkey.slice(-4)}` : 'Anonymous'));
    const avatar = userObj.avatar || 'default_avatar.png';

    return sendJson(res, 200, {
      success: true,
      pubkey: targetPubkey,
      username: resolvedUsername,
      avatar,
      score: Number(score),
      mode,
      timeframe,
      rank,
      total,
      totalPlayers: total,
      percentile,
      topPercentage,
      topPercentile: topPercentage
    });

  } catch (error: any) {
    console.error('Error in /api/leaderboard/rank handler:', error);
    return sendJson(res, 500, { success: false, error: 'Internal server error' });
  }
}

function sendJson(res: any, status: number, body: any) {
  if (res && typeof res.status === 'function') {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
    }
    return res.status(status).json(body);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*'
    }
  });
}
