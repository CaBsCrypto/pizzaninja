import http from 'http';
import { AddressInfo } from 'net';

export class InMemRedis {
  private kv = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();
  // Sorted sets: key -> Map<member, score>
  private zsets = new Map<string, Map<string, number>>();

  clear() {
    this.kv.clear();
    this.hashes.clear();
    this.sets.clear();
    this.zsets.clear();
  }

  // GET key
  get(key: string): string | null {
    return this.kv.has(key) ? this.kv.get(key)! : null;
  }

  // SET key value
  set(key: string, value: any): 'OK' {
    let valStr: string;
    if (typeof value === 'object') {
      valStr = JSON.stringify(value);
    } else if (typeof value === 'string') {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
        valStr = value;
      } else {
        valStr = JSON.stringify(value);
      }
    } else {
      valStr = JSON.stringify(value);
    }
    this.kv.set(key, valStr);
    return 'OK';
  }

  // DEL key [key ...]
  del(...keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.kv.delete(key)) count++;
      if (this.hashes.delete(key)) count++;
      if (this.sets.delete(key)) count++;
      if (this.zsets.delete(key)) count++;
    }
    return count;
  }

  // HSET key field value [field value ...]
  hset(key: string, ...args: string[]): number {
    let map = this.hashes.get(key);
    if (!map) {
      map = new Map<string, string>();
      this.hashes.set(key, map);
    }
    let added = 0;
    if (args.length === 1 && typeof args[0] === 'object') {
      const obj = args[0] as any;
      for (const [k, v] of Object.entries(obj)) {
        if (!map.has(k)) added++;
        map.set(k, String(v));
      }
    } else {
      for (let i = 0; i < args.length; i += 2) {
        const field = args[i];
        const val = args[i + 1];
        if (field !== undefined && val !== undefined) {
          if (!map.has(field)) added++;
          map.set(field, String(val));
        }
      }
    }
    return added;
  }

  // HGET key field
  hget(key: string, field: string): string | null {
    const map = this.hashes.get(key);
    if (!map) return null;
    return map.has(field) ? map.get(field)! : null;
  }

  // HGETALL key
  hgetall(key: string): Record<string, string> | any[] {
    const map = this.hashes.get(key);
    if (!map || map.size === 0) return [];
    const res: Record<string, string> = {};
    for (const [k, v] of map.entries()) {
      res[k] = v;
    }
    return res;
  }

  // SADD key member [member ...]
  sadd(key: string, ...members: string[]): number {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set<string>();
      this.sets.set(key, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  // SISMEMBER key member
  sismember(key: string, member: string): number {
    const set = this.sets.get(key);
    if (!set) return 0;
    return set.has(member) ? 1 : 0;
  }

  // ZADD key [options] score member
  zadd(key: string, ...args: any[]): number {
    let zmap = this.zsets.get(key);
    if (!zmap) {
      zmap = new Map<string, number>();
      this.zsets.set(key, zmap);
    }

    let addedOrUpdated = 0;

    // Support object call: zadd(key, { score: 10, member: "foo" })
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const { score, member } = args[0];
      const memberStr = typeof member === 'object' ? JSON.stringify(member) : String(member);
      zmap.set(memberStr, Number(score));
      return 1;
    }

    // Support array of objects: zadd(key, { score, member }, { score, member })
    if (args.length > 0 && typeof args[0] === 'object' && args[0].score !== undefined) {
      for (const item of args) {
        const memberStr = typeof item.member === 'object' ? JSON.stringify(item.member) : String(item.member);
        zmap.set(memberStr, Number(item.score));
        addedOrUpdated++;
      }
      return addedOrUpdated;
    }

    // Parse standard ZADD args: [NX|XX|CH|GT|LT] score member ...
    let idx = 0;
    while (idx < args.length && typeof args[idx] === 'string' && ['NX', 'XX', 'CH', 'GT', 'LT', 'INCR'].includes(args[idx].toUpperCase())) {
      idx++;
    }

    for (; idx < args.length; idx += 2) {
      const score = Number(args[idx]);
      const member = typeof args[idx + 1] === 'object' ? JSON.stringify(args[idx + 1]) : String(args[idx + 1]);
      zmap.set(member, score);
      addedOrUpdated++;
    }

    return addedOrUpdated;
  }

  // ZSCORE key member
  zscore(key: string, member: string): number | null {
    const zmap = this.zsets.get(key);
    if (!zmap) return null;
    const memberStr = typeof member === 'object' ? JSON.stringify(member) : String(member);
    return zmap.has(memberStr) ? zmap.get(memberStr)! : null;
  }

  // ZRANGE key start stop [WITHSCORES] [REV]
  zrange(key: string, start: number, stop: number, ...options: any[]): any[] {
    const zmap = this.zsets.get(key);
    if (!zmap) return [];

    let entries = Array.from(zmap.entries()); // [[member, score], ...]
    
    let isRev = false;
    let withScores = false;

    for (const opt of options) {
      if (typeof opt === 'object' && opt !== null) {
        if (opt.rev || opt.REV) isRev = true;
        if (opt.withScores || opt.WITHSCORES) withScores = true;
      } else if (typeof opt === 'string') {
        const u = opt.toUpperCase();
        if (u === 'REV') isRev = true;
        if (u === 'WITHSCORES') withScores = true;
      }
    }

    // Sort by score ascending, or descending if REV
    entries.sort((a, b) => isRev ? b[1] - a[1] : a[1] - b[1]);

    const total = entries.length;
    if (total === 0) return [];

    let normStart = start >= 0 ? start : Math.max(0, total + start);
    let normStop = stop >= 0 ? stop : total + stop;
    normStop = Math.min(total - 1, normStop);

    if (normStart > normStop || normStart >= total) return [];

    const sliced = entries.slice(normStart, normStop + 1);

    if (withScores) {
      const result: any[] = [];
      for (const [member, score] of sliced) {
        result.push(member, score);
      }
      return result;
    }

    return sliced.map(([member]) => member);
  }

  // ZREVRANK key member
  zrevrank(key: string, member: string): number | null {
    const zmap = this.zsets.get(key);
    if (!zmap) return null;

    const memberStr = typeof member === 'object' ? JSON.stringify(member) : String(member);
    if (!zmap.has(memberStr)) return null;

    const entries = Array.from(zmap.entries()).sort((a, b) => b[1] - a[1]);
    const rank = entries.findIndex(([m]) => m === memberStr);
    return rank === -1 ? null : rank;
  }

  // ZRANK key member
  zrank(key: string, member: string): number | null {
    const zmap = this.zsets.get(key);
    if (!zmap) return null;

    const memberStr = typeof member === 'object' ? JSON.stringify(member) : String(member);
    if (!zmap.has(memberStr)) return null;

    const entries = Array.from(zmap.entries()).sort((a, b) => a[1] - b[1]);
    const rank = entries.findIndex(([m]) => m === memberStr);
    return rank === -1 ? null : rank;
  }

  // ZREM key member [member ...]
  zrem(key: string, ...members: any[]): number {
    const zmap = this.zsets.get(key);
    if (!zmap) return 0;

    let removed = 0;
    for (const m of members) {
      const memberStr = typeof m === 'object' ? JSON.stringify(m) : String(m);
      if (zmap.delete(memberStr)) removed++;
    }
    return removed;
  }

  // ZCARD key
  zcard(key: string): number {
    const zmap = this.zsets.get(key);
    return zmap ? zmap.size : 0;
  }
}

export class MockKvServer {
  private server: http.Server | null = null;
  public store = new InMemRedis();
  public url = '';
  public token = 'mock_kv_token';

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          try {
            const urlPath = req.url || '/';
            let commands: any[] = [];

            if (urlPath === '/pipeline') {
              const pipelineReqs = JSON.parse(body || '[]');
              const responses = pipelineReqs.map((cmd: any) => ({
                result: this.executeCommand(cmd)
              }));
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(responses));
              return;
            }

            if (body && body.trim().startsWith('[')) {
              commands = JSON.parse(body);
            } else if (urlPath !== '/') {
              commands = urlPath.split('/').filter(Boolean).map(decodeURIComponent);
            }

            const result = this.executeCommand(commands);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ result }));
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.url = `http://127.0.0.1:${addr.port}`;
        process.env.KV_REST_API_URL = this.url;
        process.env.KV_REST_API_TOKEN = this.token;
        resolve(this.url);
      });
    });
  }

  executeCommand(cmd: any[]): any {
    if (!Array.isArray(cmd) || cmd.length === 0) return null;
    const op = String(cmd[0]).toUpperCase();
    const args = cmd.slice(1);

    switch (op) {
      case 'GET':
        return this.store.get(args[0]);
      case 'SET':
        return this.store.set(args[0], args[1]);
      case 'DEL':
        return this.store.del(...args);
      case 'HSET':
        return this.store.hset(args[0], ...args.slice(1));
      case 'HGET':
        return this.store.hget(args[0], args[1]);
      case 'HGETALL':
        return this.store.hgetall(args[0]);
      case 'SADD':
        return this.store.sadd(args[0], ...args.slice(1));
      case 'SISMEMBER':
        return this.store.sismember(args[0], args[1]);
      case 'ZADD':
        return this.store.zadd(args[0], ...args.slice(1));
      case 'ZSCORE':
        return this.store.zscore(args[0], args[1]);
      case 'ZRANGE':
        return this.store.zrange(args[0], Number(args[1]), Number(args[2]), ...args.slice(3));
      case 'ZREVRANK':
        return this.store.zrevrank(args[0], args[1]);
      case 'ZRANK':
        return this.store.zrank(args[0], args[1]);
      case 'ZREM':
        return this.store.zrem(args[0], ...args.slice(1));
      case 'ZCARD':
        return this.store.zcard(args[0]);
      default:
        return null;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

let globalMockServer: MockKvServer | null = null;

export async function setupMockKvServer() {
  if (!globalMockServer) {
    globalMockServer = new MockKvServer();
    await globalMockServer.start();
  }
  return globalMockServer;
}

export async function resetMockKv() {
  if (globalMockServer) {
    globalMockServer.store.clear();
  }
}
