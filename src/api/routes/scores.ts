import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
// duplicate router removed
const dataFile = path.resolve(__dirname, '../../data/scores.json');

router.post('/', async (req, res) => {
  const { email, score } = req.body;
  if (!email || typeof score !== 'number') {
    return res.status(400).json({ error: 'Email and numeric score are required' });
  }
  try {
    let scores = [] as any[];
    try {
      const content = await fs.readFile(dataFile, 'utf-8');
      scores = JSON.parse(content);
    } catch (_) {
      // file may not exist yet
    }
    scores.push({ email, score, timestamp: Date.now() });
    await fs.writeFile(dataFile, JSON.stringify(scores, null, 2));
    res.status(201).json({ email, score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
