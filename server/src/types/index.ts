/**
 * Shared domain model for the Digital Identity Intelligence prototype.
 * Every crawler normalizes into `NormalizedRecord`; every downstream service
 * consumes only that shape, so a real data source can be swapped in later
 * without touching correlation / evidence / graph logic.
 */

export type Provenance = 'PUBLIC_SOURCE' | 'ORGANIZER_PROVIDED' | 'DEMO_DATA';

export type DataMode = 'public' | 'demo';

export type SourceType =
  | 'public_profile'
  | 'public_repository'
  | 'official_organization'
  | 'event_listing'
  | 'publication'
  | 'personal_website'
  | 'search_discovery';

export type Reliability = 'High' | 'Medium-High' | 'Medium' | 'Low-Medium' | 'Low';

export type EvidenceStatus =
  | 'Verified'
  | 'Supported'
  | 'Uncertain'
  | 'Conflict'
  | 'Unavailable';

export type InvestigationStatus =
  | 'created'
  | 'processing'
  | 'complete'
  | 'insufficient_evidence'
  | 'failed';

/** A single clue derived from the authorized input. */
export interface Clue {
  id: string;
  type: 'name' | 'username' | 'organization' | 'event' | 'location' | 'keyword' | 'image';
  value: string;
  origin: 'user_context' | 'image_signal' | 'derived_from_discovery';
  derivedFrom?: string;
  confidence: number;
  note?: string;
}

/** Raw evidence snippet kept next to every extracted claim. */
export interface EvidenceSnippet {
  label: string;
  excerpt: string;
  selector?: string;
}

/** The common structure EVERY crawler must return. */
export interface NormalizedRecord {
  id: string;
  source: string;
  sourceType: SourceType;
  url: string;
  title: string;
  person: string | null;
  usernames: string[];
  organizations: string[];
  roles: string[];
  projects: string[];
  events: string[];
  publications: string[];
  locations: string[];
  dates: string[];
  links: string[];
  avatarUrl?: string | null;
  /** Average hash of the published avatar, when one could be retrieved. */
  avatarHash?: string | null;
  bio?: string | null;
  rawEvidence: EvidenceSnippet[];
  provenance: Provenance;
  discoveredAt: string;
  reliability: Reliability;
}

/** Result envelope for a single fetch attempt — never fakes success. */
export interface FetchOutcome {
  url: string;
  ok: boolean;
  status?: number;
  html?: string;
  reason?: string;
  elapsedMs: number;
  blockedBy?: 'allowlist' | 'robots' | 'timeout' | 'network' | 'http' | 'rate_limit';
}

export interface SourceAttempt {
  url: string;
  source: string;
  ok: boolean;
  reason?: string;
  blockedBy?: FetchOutcome['blockedBy'];
  elapsedMs: number;
  at: string;
}

/** A matching / conflicting signal between the subject clues and a candidate. */
export interface CorrelationSignal {
  key:
    | 'name'
    | 'username'
    | 'organization'
    | 'role'
    | 'location'
    | 'project'
    | 'event'
    | 'publication'
    | 'website'
    | 'cross_profile_link'
    | 'image_signal';
  label: string;
  score: number | null;
  weight: number;
  detail: string;
  status: 'match' | 'partial' | 'conflict' | 'unavailable';
}

export interface Candidate {
  id: string;
  rank: number;
  name: string;
  aliases: string[];
  usernames: string[];
  platform: string;
  sourceType: SourceType;
  url: string;
  organization: string | null;
  location: string | null;
  role: string | null;
  projects: string[];
  events: string[];
  publications: string[];
  avatarUrl?: string | null;
  bio?: string | null;
  signals: CorrelationSignal[];
  conflicts: string[];
  correlationScore: number;
  verdict: 'STRONG' | 'PROBABLE' | 'WEAK' | 'INSUFFICIENT';
  provenance: Provenance;
  reliability: Reliability;
  recordIds: string[];
}

export interface EvidenceItem {
  id: string;
  finding: string;
  source: string;
  sourceType: SourceType;
  url: string;
  supportingEvidence: string;
  excerpt?: string;
  provenance: Provenance;
  reliability: Reliability;
  confidence: number | null;
  status: EvidenceStatus;
  discoveredAt: string;
}

export interface Conflict {
  id: string;
  field: string;
  title: string;
  sourceA: { source: string; url: string; value: string; provenance: Provenance };
  sourceB: { source: string; url: string; value: string; provenance: Provenance };
  status: 'Unresolved' | 'Requires verification' | 'Resolved';
  note: string;
}

export interface GraphNode {
  id: string;
  type: 'person' | 'profile' | 'organization' | 'project' | 'event' | 'publication' | 'website';
  label: string;
  sublabel?: string;
  url?: string;
  confidence?: number | null;
  provenance: Provenance;
  evidence?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence?: number | null;
}

export interface TimelineEntry {
  id: string;
  date: string;
  precision: 'year' | 'month' | 'day';
  activity: string;
  organization: string | null;
  source: string;
  url: string;
  evidence: string;
  confidence: number | null;
  provenance: Provenance;
}

export interface DiscoveryStep {
  id: string;
  order: number;
  label: string;
  discovered: string;
  source: string;
  url: string;
  evidence: string;
  producedClue: string | null;
  provenance: Provenance;
}

export interface ProcessingEvent {
  at: string;
  stage: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface KnownContext {
  fullName?: string;
  username?: string;
  organization?: string;
  event?: string;
  location?: string;
  notes?: string;
}

export interface ImageSignal {
  provided: boolean;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  /** Client-computed average hash (prototype signal only). */
  aHash?: string;
  dimensions?: { width: number; height: number };
  note: string;
}

export interface IntelligenceReport {
  executiveSummary: string;
  mostLikelyIdentity: {
    name: string | null;
    confidence: number | null;
    verdict: Candidate['verdict'] | 'NONE';
    statement: string;
  };
  nameVariations: string[];
  knownUsernames: string[];
  publicProfiles: { platform: string; url: string; provenance: Provenance }[];
  professionalAffiliations: { organization: string; role: string | null; source: string }[];
  publicActivities: { name: string; type: string; source: string; url: string }[];
  projects: { name: string; source: string; url: string }[];
  publications: { title: string; source: string; url: string }[];
  evidenceSummary: { total: number; byStatus: Record<string, number> };
  confidence: number | null;
  conflicts: Conflict[];
  uncertainty: string[];
  dataAuthorization: string;
  generatedAt: string;
}

export interface Investigation {
  id: string;
  label: string;
  mode: DataMode;
  status: InvestigationStatus;
  createdAt: string;
  completedAt?: string;
  context: KnownContext;
  imageSignal: ImageSignal;
  clues: Clue[];
  attempts: SourceAttempt[];
  records: NormalizedRecord[];
  candidates: Candidate[];
  evidence: EvidenceItem[];
  conflicts: Conflict[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  timeline: TimelineEntry[];
  discoveryChain: DiscoveryStep[];
  processingLog: ProcessingEvent[];
  report: IntelligenceReport | null;
  stats: {
    sourcesAttempted: number;
    sourcesRetrieved: number;
    candidatesFound: number;
    profilesCorrelated: number;
    evidenceItems: number;
    conflicts: number;
    averageConfidence: number | null;
  };
}

export interface InvestigationSummary {
  id: string;
  label: string;
  mode: DataMode;
  status: InvestigationStatus;
  createdAt: string;
  subject: string;
  confidence: number | null;
  sources: number;
  candidates: number;
}
