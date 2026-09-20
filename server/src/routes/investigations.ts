import { Router } from 'express';
import multer from 'multer';
import type { DataMode, ImageSignal, KnownContext } from '../types/index.js';
import {
  analyzeInvestigation,
  createInvestigation,
  dashboardStats,
  getInvestigation,
  listInvestigations,
} from '../services/investigationService.js';
import { sourceStatus } from '../services/discoveryService.js';
import { SOURCE_RELIABILITY_TABLE } from '../services/evidenceService.js';
import { averageHashFromBuffer } from '../services/imageSignalService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      cb(new Error('Only PNG, JPEG, WEBP or GIF images are accepted.'));
      return;
    }
    cb(null, true);
  },
});

export const investigationsRouter = Router();

const notFound = (res: any) =>
  res.status(404).json({ error: 'Investigation not found.', code: 'NOT_FOUND' });

investigationsRouter.get('/dashboard/stats', (_req, res) => {
  res.json(dashboardStats());
});

investigationsRouter.get('/sources/status', (_req, res) => {
  res.json({
    allowlist: sourceStatus(),
    reliability: SOURCE_RELIABILITY_TABLE,
    note: 'Prototype source classification. Only enabled allowlisted domains are retrieved automatically, subject to robots.txt.',
  });
});

investigationsRouter.get('/investigations', (_req, res) => {
  res.json(listInvestigations());
});

investigationsRouter.post('/investigations', upload.single('photo'), async (req, res) => {
  const body = req.body as Record<string, string>;
  const mode: DataMode = body.mode === 'public' ? 'public' : 'demo';

  const context: KnownContext = {
    fullName: body.fullName?.trim() || undefined,
    username: body.username?.trim() || undefined,
    organization: body.organization?.trim() || undefined,
    event: body.event?.trim() || undefined,
    location: body.location?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
  };

  const hasContext = Object.values(context).some(Boolean);
  if (!req.file && !hasContext) {
    res.status(400).json({
      error:
        'Provide an authorized photograph or at least one piece of known context before starting an analysis.',
      code: 'EMPTY_INPUT',
    });
    return;
  }

  const image: ImageSignal = {
    provided: Boolean(req.file),
    fileName: req.file?.originalname,
    sizeBytes: req.file?.size,
    mimeType: req.file?.mimetype,
    // Hashed here rather than in the browser so that both sides of every
    // comparison go through the same decoder and the same resampling.
    aHash: req.file ? ((await averageHashFromBuffer(req.file.buffer)) ?? undefined) : undefined,
    note:
      'Perceptual-hash image signal. The photograph is held in memory for this session only, is never transmitted to any third party, and is NOT used for face recognition. It can only detect whether the same image file is republished as a public avatar.',
  };

  const investigation = createInvestigation({ context, image, mode });
  res.status(201).json(investigation);
});

investigationsRouter.post('/investigations/:id/analyze', async (req, res) => {
  const existing = getInvestigation(req.params.id);
  if (!existing) return notFound(res);
  const result = await analyzeInvestigation(req.params.id);
  res.json(result);
});

investigationsRouter.get('/investigations/:id', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv);
});

investigationsRouter.get('/investigations/:id/candidates', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv.candidates);
});

investigationsRouter.get('/investigations/:id/evidence', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json({ evidence: inv.evidence, conflicts: inv.conflicts, attempts: inv.attempts });
});

investigationsRouter.get('/investigations/:id/graph', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv.graph);
});

investigationsRouter.get('/investigations/:id/timeline', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv.timeline);
});

investigationsRouter.get('/investigations/:id/footprint', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv.records);
});

investigationsRouter.get('/investigations/:id/discovery-chain', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  res.json(inv.discoveryChain);
});

investigationsRouter.get('/investigations/:id/report', (req, res) => {
  const inv = getInvestigation(req.params.id);
  if (!inv) return notFound(res);
  if (!inv.report) {
    res.status(409).json({
      error: 'Report not generated yet. Run the analysis first.',
      code: 'NO_REPORT',
    });
    return;
  }
  res.json(inv.report);
});
