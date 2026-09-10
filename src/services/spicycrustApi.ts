/**
 * SpicyCrust API Service — Slash Slice Integration
 * API Base URL : https://spicycrust-api.alphadocere.cl/api/v1
 * Game Slug    : slash-slice
 * X-Game-Key   : 571991be2b13ee59b8c653d50edfc355c5b20c100cdcf9f3d5f379fa57623602
 */

const API_BASE = 'https://spicycrust-api.alphadocere.cl/api/v1';
const GAME_KEY = '571991be2b13ee59b8c653d50edfc355c5b20c100cdcf9f3d5f379fa57623602';
const GAME_SLUG = 'slash-slice';

let _seasonSlug: string | null = null;

export interface SpicyCrustScorePayload {
  nickname: string;
  email?: string;
  score: number;
  metadata?: Record<string, any>;
  player_external_id?: string;
}

export interface SpicyCrustLeaderboardEntry {
  rank?: number;
  player_id?: string;
  player_external_id?: string;
  nickname: string;
  score: number;
  created_at?: string;
  metadata?: Record<string, any>;
}

export async function getActiveSeason(): Promise<string> {
  if (_seasonSlug) return _seasonSlug;
  try {
    const res = await fetch(`${API_BASE}/seasons?status=active`, { 
      signal: AbortSignal.timeout(4000) 
    });
    const json = await res.json();
    const season = Array.isArray(json) 
      ? json[0] 
      : (Array.isArray(json?.data) ? json.data[0] : (json.data ?? json));
    if (season?.slug) {
      _seasonSlug = season.slug;
      return _seasonSlug;
    }
  } catch (e: any) {
    console.warn('[SpicyCrust] Season fallback:', e.message);
  }
  return 'season-01';
}

export async function submitScore({ 
  nickname, 
  email = '', 
  score, 
  metadata = {},
  player_external_id
}: SpicyCrustScorePayload) {
  try {
    const seasonSlug = await getActiveSeason();
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Game-Key': GAME_KEY
      },
      body: JSON.stringify({
        game_slug: GAME_SLUG,
        season_slug: seasonSlug,
        player_external_id: player_external_id || ('player-' + Date.now()),
        email: email || '',
        nickname: nickname || 'CHEF_NINJA',
        score: Number(score) || 0,
        metadata: metadata || {}
      }),
      signal: AbortSignal.timeout(8000)
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      console.error('[SpicyCrust API] Submit rejected with status', res.status, json);
      throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
    }
    return json;
  } catch (err: any) {
    console.error('[SpicyCrust API] Submit error:', err);
    throw err;
  }
}

export async function getLeaderboard(limit = 10): Promise<SpicyCrustLeaderboardEntry[]> {
  try {
    const seasonSlug = await getActiveSeason();
    const res = await fetch(
      `${API_BASE}/leaderboard?game=${GAME_SLUG}&season=${seasonSlug}&limit=${limit}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const json = await res.json();
    return json?.data?.ranking ?? json?.data?.leaderboard ?? [];
  } catch (e: any) {
    console.warn('[SpicyCrust] Leaderboard fallback:', e.message);
    return [];
  }
}
