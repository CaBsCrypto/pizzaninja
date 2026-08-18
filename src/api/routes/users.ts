import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
const dataFile = path.resolve(__dirname, '../../data/users.json');

// Simple email regex for format validation
const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  try {
    let users = [] as any[];
    try {
      const content = await fs.readFile(dataFile, 'utf-8');
      users = JSON.parse(content);
    } catch (_) {
      // file may not exist yet
    }
    // prevent duplicate email registration
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const newUser = { id: Date.now().toString(), name, email, createdAt: Date.now() };
    users.push(newUser);
    await fs.writeFile(dataFile, JSON.stringify(users, null, 2));
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
