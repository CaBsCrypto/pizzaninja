import { kv } from '@vercel/kv';

const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,15}$/;

export default async function handler(req: any, res?: any) {
  // CORS setup
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
        'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      }
    });
  }

  const client = kv as any;

  try {
    if (method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }
      if (!body && typeof req.json === 'function') {
        try {
          body = await req.json();
        } catch (e) {
          body = {};
        }
      }
      body = body || {};

      const { pubkey, username, avatar, privyDid } = body;

      // Validate Stellar public key
      if (!pubkey || typeof pubkey !== 'string' || !STELLAR_PUBKEY_REGEX.test(pubkey)) {
        return sendJson(res, 400, { success: false, error: 'Invalid Stellar public key format' });
      }

      // Validate username format
      if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
        return sendJson(res, 400, { success: false, error: 'Invalid username format. Must be 3-15 alphanumeric characters or underscores.' });
      }

      const normalizedUsername = username.toLowerCase();
      const usernameKey = `slashslice:username:${normalizedUsername}`;
      const userKey = `slashslice:user:${pubkey}`;

      // Case-insensitive uniqueness check
      const existingOwner = await client.get(usernameKey);
      if (existingOwner && existingOwner !== pubkey) {
        return sendJson(res, 409, { success: false, error: 'Username already taken' });
      }

      if (!existingOwner) {
        const claimed = await client.set(usernameKey, pubkey, { nx: true });
        if (claimed === null || claimed === false) {
          const checkOwner = await client.get(usernameKey);
          if (checkOwner && checkOwner !== pubkey) {
            return sendJson(res, 409, { success: false, error: 'Username already taken' });
          }
        }
      }

      // Fetch existing profile if updating
      let existingProfileRaw = await client.get(userKey);
      if (!existingProfileRaw) {
        existingProfileRaw = await client.hgetall(userKey);
      }
      let existingProfile: any = null;
      if (existingProfileRaw) {
        if (typeof existingProfileRaw === 'string') {
          try {
            existingProfile = JSON.parse(existingProfileRaw);
          } catch (e) {}
        } else if (typeof existingProfileRaw === 'object' && Object.keys(existingProfileRaw).length > 0) {
          existingProfile = existingProfileRaw;
        }
      }

      // Cleanup old indexes if user changed username or privyDid
      if (existingProfile?.username && existingProfile.username.toLowerCase() !== normalizedUsername) {
        const oldNormalized = existingProfile.username.toLowerCase();
        await client.del(`slashslice:username:${oldNormalized}`);
      }

      const validAvatar = typeof avatar === 'string' ? avatar : undefined;
      const validPrivyDid = typeof privyDid === 'string' ? privyDid : undefined;

      const newPrivyDid = validPrivyDid ?? (typeof existingProfile?.privyDid === 'string' ? existingProfile.privyDid : '');
      if (existingProfile?.privyDid && existingProfile.privyDid !== newPrivyDid && existingProfile.privyDid !== '') {
        await client.del(`slashslice:privy:${existingProfile.privyDid}`);
      }

      // Preserve existing profile high scores and backfill from ZSET keys if present
      const existingArcade = existingProfile?.arcadeScore !== undefined && existingProfile?.arcadeScore !== null ? Number(existingProfile.arcadeScore) : 0;
      const existingClassic = existingProfile?.classicScore !== undefined && existingProfile?.classicScore !== null ? Number(existingProfile.classicScore) : 0;

      let arcadeZsetRaw = await client.zscore('slashslice:leaderboard:arcade:alltime', pubkey);
      if (arcadeZsetRaw === null || arcadeZsetRaw === undefined) {
        arcadeZsetRaw = await client.zscore(`slashslice:scores:${pubkey}`, 'arcade');
      }
      const arcadeZset = arcadeZsetRaw !== null && arcadeZsetRaw !== undefined ? Number(arcadeZsetRaw) : 0;

      let classicZsetRaw = await client.zscore('slashslice:leaderboard:classic:alltime', pubkey);
      if (classicZsetRaw === null || classicZsetRaw === undefined) {
        classicZsetRaw = await client.zscore(`slashslice:scores:${pubkey}`, 'classic');
      }
      const classicZset = classicZsetRaw !== null && classicZsetRaw !== undefined ? Number(classicZsetRaw) : 0;

      const arcadeScore = Math.max(existingArcade, arcadeZset);
      const classicScore = Math.max(existingClassic, classicZset);

      const now = new Date().toISOString();
      const profile = {
        pubkey,
        username,
        avatar: validAvatar || (typeof existingProfile?.avatar === 'string' ? existingProfile.avatar : 'default'),
        privyDid: newPrivyDid,
        arcadeScore,
        classicScore,
        createdAt: existingProfile?.createdAt || now,
        updatedAt: now
      };

      // Store user profile object under Redis hash & JSON
      await client.set(userKey, JSON.stringify(profile));
      await client.hset(userKey, profile);

      // Store reverse lookup slashslice:username:<normalized_username> -> pubkey
      await client.set(usernameKey, pubkey);

      // Store reverse lookup slashslice:privy:<privyDid> -> pubkey
      if (profile.privyDid) {
        await client.set(`slashslice:privy:${profile.privyDid}`, pubkey);
      }

      return sendJson(res, 201, { success: true, user: profile });
    }

    if (method === 'GET') {
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

      if (!pubkey && !username) {
        return sendJson(res, 400, { success: false, error: 'Missing pubkey or username parameter' });
      }

      let targetPubkey = pubkey;

      if (targetPubkey) {
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
      }

      const userKey = `slashslice:user:${targetPubkey}`;
      let profileRaw = await client.get(userKey);
      if (!profileRaw) {
        profileRaw = await client.hgetall(userKey);
      }

      if (!profileRaw || (typeof profileRaw === 'object' && Object.keys(profileRaw).length === 0)) {
        return sendJson(res, 404, { success: false, error: 'User not found' });
      }

      let profile: any;
      if (typeof profileRaw === 'string') {
        try {
          profile = JSON.parse(profileRaw);
        } catch (e) {
          profile = profileRaw;
        }
      } else {
        profile = profileRaw;
      }

      // Fetch user stats
      let arcadeScoreRaw = await client.zscore('slashslice:leaderboard:arcade:alltime', targetPubkey);
      if (arcadeScoreRaw === null || arcadeScoreRaw === undefined) {
        arcadeScoreRaw = await client.zscore(`slashslice:scores:${targetPubkey}`, 'arcade');
      }
      const arcadeScore = arcadeScoreRaw !== null && arcadeScoreRaw !== undefined ? Number(arcadeScoreRaw) : 0;

      let classicScoreRaw = await client.zscore('slashslice:leaderboard:classic:alltime', targetPubkey);
      if (classicScoreRaw === null || classicScoreRaw === undefined) {
        classicScoreRaw = await client.zscore(`slashslice:scores:${targetPubkey}`, 'classic');
      }
      const classicScore = classicScoreRaw !== null && classicScoreRaw !== undefined ? Number(classicScoreRaw) : 0;

      let arcadeRankZero = await client.zrevrank('slashslice:leaderboard:arcade:alltime', targetPubkey);
      const arcadeRank = (arcadeRankZero !== null && arcadeRankZero !== undefined) ? Number(arcadeRankZero) + 1 : null;

      let classicRankZero = await client.zrevrank('slashslice:leaderboard:classic:alltime', targetPubkey);
      const classicRank = (classicRankZero !== null && classicRankZero !== undefined) ? Number(classicRankZero) + 1 : null;

      const globalRank = arcadeRank;

      return sendJson(res, 200, {
        success: true,
        user: profile,
        stats: {
          arcadeScore,
          classicScore,
          globalRank
        },
        ...profile,
        scores: {
          arcade: arcadeScore,
          classic: classicScore
        },
        rank: {
          arcade: arcadeRank,
          classic: classicRank
        }
      });
    }

    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Error in /api/user handler:', error);
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
