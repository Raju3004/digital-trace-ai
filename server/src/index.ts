import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

// Serve the built client (client/dist) from this same server process when it
// exists, so one deployed service handles both the API and the app.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Central error handler.
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
  console.log('Digital Identity Intelligence — API');
  console.log('http://localhost:' + PORT + '/api/health');
  console.log('OSINT DEMO DATASET MODE — searches the bundled local CSV only, no live internet access');
});

