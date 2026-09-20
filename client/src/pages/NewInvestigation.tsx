import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  ImageUp,
  Loader2,
  Lock,
  Play,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Field, PageHeader, Panel, PanelHeader, SectionTitle, cx } from '../components/ui';
import { api, ApiError } from '../services/api';
import { useApp } from '../context/AppContext';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

interface ContextForm {
  fullName: string;
  username: string;
  organization: string;
  event: string;
  location: string;
  notes: string;
}

const EMPTY: ContextForm = {
  fullName: '',
  username: '',
  organization: '',
  event: '',
  location: '',
  notes: '',
};

const DEMO_FILL: ContextForm = {
  fullName: 'Rahul Kumar',
  username: 'rahul_dev',
  organization: 'Example Technologies',
  event: 'Prometheus Hackathon',
  location: 'Hyderabad',
  notes: 'AI, cybersecurity, fraud detection',
};

/** Average-hash of the uploaded image, computed locally in the browser. */
async function computeAverageHash(file: File): Promise<{ hash: string; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 8;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const grays: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
    let hex = '';
    for (let i = 0; i < grays.length; i += 4) {
      let nibble = 0;
      for (let j = 0; j < 4; j++) if (grays[i + j] > mean) nibble |= 1 << (3 - j);
      hex += nibble.toString(16);
    }
    const result = { hash: hex, width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return result;
  } catch {
    return null;
  }
}

export default function NewInvestigation() {
  const navigate = useNavigate();
  const { mode, setMode, setInvestigation, pushToast } = useApp();

  const [form, setForm] = useState<ContextForm>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ hash: string; width: number; height: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ContextForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const acceptFile = async (f: File) => {
    setFileError(null);
    if (!ACCEPTED.includes(f.type)) {
      setFileError('Unsupported file type. Use PNG, JPEG, WEBP or GIF.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError('Image exceeds the 8 MB limit.');
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));

    // Simulated read progress — the file never leaves the browser until submit.
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 12;
      });
    }, 45);

    const meta = await computeAverageHash(f);
    setImageMeta(meta);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const removeImage = () => {
    setFile(null);
    setPreview(null);
    setImageMeta(null);
    setProgress(0);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const hasContext = Object.values(form).some((v) => v.trim());
  const canSubmit = (Boolean(file) || hasContext) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('mode', mode);
      Object.entries(form).forEach(([k, v]) => v.trim() && fd.append(k, v.trim()));
      // The perceptual hash is computed server-side, so that the photograph and
      // every avatar it is compared against go through the same decoder.
      if (file) fd.append('photo', file);

      const inv = await api.createInvestigation(fd);
      setInvestigation(inv);
      navigate(`/processing/${inv.id}`);
    } catch (err) {
      pushToast({
        title: 'Could not start analysis',
        message: err instanceof ApiError ? err.message : 'Unexpected error.',
        tone: 'error',
      });
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Intake"
        title="Start New Investigation"
        subtitle="Analyze an authorized identity using public-source information."
        actions={
          <button
            className="btn-ghost"
            onClick={() => {
              setForm(DEMO_FILL);
              pushToast({
                title: 'Demo context loaded',
                message: 'The jury-demo subject has been filled in. Upload any image and start the analysis.',
                tone: 'info',
              });
            }}
          >
            <Wand2 size={15} />
            Fill demo context
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Upload */}
        <div>
          <SectionTitle>Authorized Photograph</SectionTitle>
          <Panel className="p-5">
            {!preview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                className={cx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200',
                  dragging
                    ? 'border-violet-core/60 bg-violet-core/[0.07]'
                    : 'border-white/[0.1] hover:border-violet-core/40 hover:bg-white/[0.02]',
                )}
              >
                <div className="mb-4 rounded-xl border border-white/[0.09] bg-white/[0.03] p-3.5 text-violet-soft">
                  <ImageUp size={22} />
                </div>
                <div className="text-sm font-medium text-slate-200">UPLOAD AUTHORIZED PHOTOGRAPH</div>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                  Drag and drop an image here, or click to browse. PNG, JPEG, WEBP or GIF, up to 8 MB.
                </p>
                <span className="btn-ghost mt-5">Browse file</span>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="flex gap-4">
                  <img
                    src={preview}
                    alt="Authorized upload preview"
                    className="h-32 w-32 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">{file?.name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {((file?.size ?? 0) / 1024).toFixed(0)} KB
                          {imageMeta && ` · ${imageMeta.width}×${imageMeta.height}`}
                        </div>
                      </div>
                      <button
                        onClick={removeImage}
                        className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
                        title="Remove image"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-violet-core transition-[width] duration-150"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>

                    {progress >= 100 && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-300">
                        <CheckCircle2 size={13} />
                        Image validated
                      </div>
                    )}

                    {imageMeta && (
                      <div className="mt-2 text-[10px] text-slate-500">
                        Will be compared against public avatars by perceptual hash
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-cyan-core/20 bg-cyan-core/[0.05] px-3.5 py-2.5">
                  <div className="flex items-start gap-2 text-[11px] leading-relaxed text-cyan-soft/90">
                    <ImageIcon size={13} className="mt-0.5 shrink-0" />
                    <span>
                      <strong className="font-semibold">Image signal active.</strong> The photograph is
                      reduced to a 256-bit perceptual hash and compared against avatars published by
                      profiles the system finds through handles and context. A match is strong
                      corroboration; a different picture counts as no information, never against a
                      candidate.
                      <br />
                      <strong className="font-semibold">No face recognition.</strong> This verifies that
                      the same picture is in use. It cannot identify an unknown person from a photograph,
                      and the image is never sent to a third party.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {fileError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[11px] text-rose-300">
                <AlertTriangle size={13} />
                {fileError}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptFile(f);
              }}
            />
          </Panel>

          <Panel className="mt-4 p-4">
            <div className="flex items-start gap-2.5 text-[11px] leading-relaxed text-slate-400">
              <Lock size={13} className="mt-0.5 shrink-0 text-violet-soft" />
              <span>
                Only authorized, consented, synthetic or permitted public information is processed.
                Private or restricted data is not accessed. No credentials are collected, no
                authentication is attempted, and no anti-bot protection is evaded.
              </span>
            </div>
          </Panel>
        </div>

        {/* Context */}
        <div>
          <SectionTitle hint="all fields optional">Known Context</SectionTitle>
          <Panel>
            <PanelHeader
              title="Contextual clues"
              subtitle="Supplied context seeds the discovery engine. More context produces more independent correlation signals."
            />
            <div className="space-y-4 p-5">
              <Field label="Full Name">
                <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="e.g. Rahul Kumar" />
              </Field>
              <Field label="Username / Alias">
                <input className="input" value={form.username} onChange={set('username')} placeholder="e.g. rahul_dev" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organization">
                  <input className="input" value={form.organization} onChange={set('organization')} placeholder="e.g. Example Technologies" />
                </Field>
                <Field label="Event / Conference">
                  <input className="input" value={form.event} onChange={set('event')} placeholder="e.g. Prometheus Hackathon" />
                </Field>
              </div>
              <Field label="Location">
                <input className="input" value={form.location} onChange={set('location')} placeholder="e.g. Hyderabad" />
              </Field>
              <Field label="Additional Context" hint="Keywords are extracted from this field and used as search clues.">
                <textarea
                  className="input min-h-[84px] resize-y"
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="e.g. AI, cybersecurity, fraud detection"
                />
              </Field>
            </div>
            {mode === 'demo' && (
              <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="text-[11px] leading-relaxed text-amber-200/90">
                  <strong className="font-semibold">Demo Data Mode ignores these fields.</strong> It
                  always analyzes the built-in synthetic subject (Rahul Kumar) from a local fixture.
                  To analyze a real person from live public sources, switch to{' '}
                  <button
                    className="underline underline-offset-2 hover:text-amber-100"
                    onClick={() => setMode('public')}
                  >
                    Public Source Mode
                  </button>{' '}
                  in the top bar.
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
              <span className="text-[11px] text-slate-500">
                {file
                  ? hasContext
                    ? 'Image and context ready.'
                    : 'Image ready — context is optional but improves correlation.'
                  : hasContext
                    ? 'Context ready — no image supplied.'
                    : 'Supply an image or at least one context field.'}
              </span>
              <button className="btn-primary shrink-0" disabled={!canSubmit} onClick={submit}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Start Analysis
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
