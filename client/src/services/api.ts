import type {
  Candidate,
  Conflict,
  DataMode,
  DiscoveryStep,
  EvidenceItem,
  Investigation,
  InvestigationSummary,
  IntelligenceReport,
  NormalizedRecord,
  SourceAttempt,
  TimelineEntry,
  GraphEdge,
  GraphNode,
} from '../types';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(
      'Cannot reach the analysis service. Confirm the API server is running on port 4000.',
      'NETWORK',
      0,
    );
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(
      body?.error ?? `Request failed with HTTP ${res.status}.`,
      body?.code ?? 'HTTP_ERROR',
      res.status,
    );
  }
  return body as T;
}

export interface DashboardStats {
  investigations: number;
  candidatesFound: number;
  profilesCorrelated: number;
  evidenceSources: number;
  averageConfidence: number | null;
  conflictsDetected: number;
  active: {
    id: string;
    label: string;
    status: string;
    confidence: number | null;
    sources: number;
    profiles: number;
    organizations: number;
    events: number;
    projects: number;
    mode: DataMode;
  } | null;
}

export interface SourceStatus {
  allowlist: {
    domain: string;
    label: string;
    sourceType: string;
    reliability: string;
    basis: string;
    enabled: boolean;
  }[];
  reliability: { sourceType: string; label: string; reliability: string }[];
  note: string;
}

export const api = {
  health: () => request<{ status: string; mode: string; time: string }>('/health'),
  dashboard: () => request<DashboardStats>('/dashboard/stats'),
  sources: () => request<SourceStatus>('/sources/status'),
  listInvestigations: () => request<InvestigationSummary[]>('/investigations'),
  getInvestigation: (id: string) => request<Investigation>(`/investigations/${id}`),
  createInvestigation: (form: FormData) =>
    request<Investigation>('/investigations', { method: 'POST', body: form }),
  analyze: (id: string) =>
    request<Investigation>(`/investigations/${id}/analyze`, { method: 'POST' }),
  candidates: (id: string) => request<Candidate[]>(`/investigations/${id}/candidates`),
  evidence: (id: string) =>
    request<{ evidence: EvidenceItem[]; conflicts: Conflict[]; attempts: SourceAttempt[] }>(
      `/investigations/${id}/evidence`,
    ),
  graph: (id: string) =>
    request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/investigations/${id}/graph`),
  timeline: (id: string) => request<TimelineEntry[]>(`/investigations/${id}/timeline`),
  footprint: (id: string) => request<NormalizedRecord[]>(`/investigations/${id}/footprint`),
  discoveryChain: (id: string) => request<DiscoveryStep[]>(`/investigations/${id}/discovery-chain`),
  report: (id: string) => request<IntelligenceReport>(`/investigations/${id}/report`),
};
