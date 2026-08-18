import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
import scoresRouter from './routes/scores';
import leaderboardRouter from './routes/leaderboard';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true })); // same‑origin by default; can be tightened later
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.listen(PORT, () => {
  console.log(`🚀 API server listening on http://localhost:${PORT}`);
});
