import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataFile = path.resolve(__dirname, '../../data/scores.json');

router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  try {
    let scores = [] as any[];
    try {
      const content = await fs.readFile(dataFile, 'utf-8');
      scores = JSON.parse(content);
    } catch (_) {
      // no scores yet
    }
    // sort descending by score
    const sorted = scores.sort((a, b) => b.score - a.score);
    const top = sorted.slice(0, limit);
    res.json({ limit, total: scores.length, rankings: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
