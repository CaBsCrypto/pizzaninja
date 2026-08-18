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

async function resolvePubkeyFromRedis(client: any, mode: string, timeframe: string, score: number, rawPubkey: any): Promise<string> {
  const cleaned = cleanPubkey(rawPubkey);
  if (STELLAR_PUBKEY_REGEX.test(cleaned)) {
    return cleaned;
  }

  // Fallback 1: Check slashslice:leaderboard_v2 ZSET records
  try {
    const legacyRecords = await client.zrange('slashslice:leaderboard_v2', 0, -1);
    if (Array.isArray(legacyRecords)) {
      for (const recStr of legacyRecords) {
        try {
          const rec = typeof recStr === 'string' ? JSON.parse(recStr) : recStr;
          if (rec && Number(rec.score) === score && (rec.mode || 'arcade') === mode && rec.pubkey && STELLAR_PUBKEY_REGEX.test(cleanPubkey(rec.pubkey))) {
            return cleanPubkey(rec.pubkey);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Fallback 2: Check slashslice:scores:<pubkey> keys
  try {
    const scoreKeys: string[] = await client.keys('slashslice:scores:*');
    if (Array.isArray(scoreKeys)) {
      for (const sKey of scoreKeys) {
        const candidatePubkey = cleanPubkey(sKey.replace('slashslice:scores:', ''));
        if (!STELLAR_PUBKEY_REGEX.test(candidatePubkey)) continue;

        const candidateScore = await client.zscore(sKey, mode);
        if (candidateScore !== null && candidateScore !== undefined && Number(candidateScore) === score) {
          return candidatePubkey;
        }
      }
    }
  } catch (e) {}

  // Fallback 3: Check slashslice:user:<pubkey> keys
  try {
    const userKeys: string[] = await client.keys('slashslice:user:*');
    if (Array.isArray(userKeys)) {
      for (const uKey of userKeys) {
        const candidatePubkey = cleanPubkey(uKey.replace('slashslice:user:', ''));
        if (!STELLAR_PUBKEY_REGEX.test(candidatePubkey)) continue;

        const targetKey = `slashslice:leaderboard:${mode}:${timeframe}`;
        let candidateScore = await client.zscore(targetKey, candidatePubkey);
        if (candidateScore === null || candidateScore === undefined) {
          candidateScore = await client.zscore(targetKey, JSON.stringify(candidatePubkey));
        }

        if (candidateScore !== null && candidateScore !== undefined && Number(candidateScore) === score) {
          return candidatePubkey;
        }
      }
    }
  } catch (e) {}

  return cleaned;
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

    const mode = query.mode || 'arcade';
    const timeframe = query.timeframe || 'alltime';
    const limitRaw = query.limit !== undefined ? query.limit : 20;
    const pageRaw = query.page !== undefined ? query.page : 1;

    // Validate mode parameter
    if (mode !== 'arcade' && mode !== 'classic') {
      return sendJson(res, 400, { success: false, error: 'Invalid mode parameter. Allowed values: arcade, classic' });
    }

    // Validate timeframe parameter
    if (timeframe !== 'alltime' && timeframe !== 'weekly' && timeframe !== 'daily') {
      return sendJson(res, 400, { success: false, error: 'Invalid timeframe parameter. Allowed values: alltime, weekly, daily' });
    }

    // Validate limit and page parameters
    const limit = Number(limitRaw);
    const page = Number(pageRaw);

    if (isNaN(limit) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return sendJson(res, 400, { success: false, error: 'Invalid limit parameter. Must be an integer between 1 and 100.' });
    }

    if (isNaN(page) || !Number.isInteger(page) || page < 1) {
      return sendJson(res, 400, { success: false, error: 'Invalid page parameter. Must be an integer >= 1.' });
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
    let total = await client.zcard(dynamicKey);
    if (total === 0 && dynamicKey !== genericKey) {
      const genericTotal = await client.zcard(genericKey);
      if (genericTotal > 0) {
        keyToUse = genericKey;
        total = genericTotal;
      }
    }

    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    const rawList = await client.zrange(keyToUse, start, stop, { rev: true, withScores: true });

    const entries: any[] = [];
    let idx = 0;
    let rankOffset = 0;

    if (Array.isArray(rawList)) {
      while (idx < rawList.length) {
        const item = rawList[idx];
        let rawPubkey: any = '';
        let score: number = 0;

        if (typeof item === 'object' && item !== null && 'member' in item) {
          rawPubkey = item.member;
          score = Number(item.score);
          idx += 1;
        } else if ((typeof item === 'string' || Buffer.isBuffer(item)) && idx + 1 < rawList.length && (typeof rawList[idx + 1] === 'number' || (!isNaN(Number(rawList[idx + 1])) && typeof rawList[idx + 1] !== 'object'))) {
          rawPubkey = item;
          score = Number(rawList[idx + 1]);
          idx += 2;
        } else if (typeof item === 'string' || Buffer.isBuffer(item)) {
          rawPubkey = item;
          let fetchedScore = await client.zscore(keyToUse, rawPubkey);
          if (fetchedScore === null || fetchedScore === undefined) {
            fetchedScore = await client.zscore(keyToUse, JSON.stringify(rawPubkey));
          }
          score = fetchedScore !== null && fetchedScore !== undefined ? Number(fetchedScore) : 0;
          idx += 1;
        } else {
          idx += 1;
          continue;
        }

        const currentRank = start + rankOffset + 1;
        rankOffset += 1;

        const pubkey = await resolvePubkeyFromRedis(client, mode, timeframe, score, rawPubkey);

        // Fetch user profile metadata from slashslice:user:<pubkey>
        let userProfileRaw = await client.get(`slashslice:user:${pubkey}`);
        if (!userProfileRaw) {
          userProfileRaw = await client.hgetall(`slashslice:user:${pubkey}`);
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

        const username = cleanUsername(userObj.username) || (pubkey.length > 10 ? `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}` : 'Anonymous');
        const avatar = userObj.avatar || 'default_avatar.png';

        const percentile = total > 0 ? Number((((total - currentRank + 1) / total) * 100).toFixed(2)) : 0;
        const topPercentage = total > 0 ? Number(((currentRank / total) * 100).toFixed(2)) : 0;

        entries.push({
          rank: currentRank,
          pubkey,
          username,
          avatar,
          score,
          mode,
          timeframe,
          percentile,
          topPercentage
        });
      }
    }

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return sendJson(res, 200, {
      success: true,
      mode,
      timeframe,
      page,
      limit,
      total,
      totalPages,
      players: entries,
      entries
    });

  } catch (error: any) {
    console.error('Error in /api/leaderboard handler:', error);
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
