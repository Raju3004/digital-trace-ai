import express from 'express';
import cors from 'cors';
import { investigationsRouter } from './routes/investigations.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ONLINE', mode: 'AUTHORIZED DATA MODE', time: new Date().toISOString() });
});

app.use('/api', investigationsRouter);

// Central error handler — one failing source or upload never takes the API down.
app.use(
  (
    err: Error & { code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({
      error: err.message || 'Unexpected server error.',
      code: err.code ?? 'SERVER_ERROR',
    });
  },
);

app.listen(PORT, () => {
  console.log(`\n  Digital Identity Intelligence — API`);
  console.log(`  http://localhost:${PORT}/api/health`);
    console.log(`  OSINT DEMO DATASET MODE · searches the bundled local CSV only, no live internet access\n`);
});
