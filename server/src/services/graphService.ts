import type { Candidate, GraphEdge, GraphNode, NormalizedRecord } from '../types/index.js';
import { shortId } from '../utils/ids.js';
import { normalize } from '../utils/text.js';

/**
 * RELATIONSHIP GRAPH
 *
 * Builds Person → Profile / Organization / Project / Event / Publication /
 * Website. Every edge carries the evidence and confidence that produced it.
 */
export function buildKnowledgeGraph(
  records: NormalizedRecord[],
  candidates: Candidate[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const top = candidates[0];
  if (!top) return { nodes: [], edges: [] };

  const cluster = records.filter((r) => top.recordIds.includes(r.id));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Map<string, string>();

  const personId = 'person_root';
  nodes.push({
    id: personId,
    type: 'person',
    label: top.name,
    sublabel: top.aliases.length ? `also: ${top.aliases.join(', ')}` : top.role ?? undefined,
    confidence: top.correlationScore,
    provenance: top.provenance,
    evidence: `Correlated from ${cluster.length} public record(s).`,
  });

  const ensure = (
    type: GraphNode['type'],
    label: string,
    rec: NormalizedRecord,
    sublabel?: string,
  ): string => {
    const key = `${type}:${normalize(label)}`;
    const existing = nodeIds.get(key);
    if (existing) return existing;
    const id = shortId('node');
    nodeIds.set(key, id);
    nodes.push({
      id,
      type,
      label,
      sublabel,
      url: rec.url,
      confidence: null,
      provenance: rec.provenance,
      evidence: rec.rawEvidence[0]?.excerpt ?? rec.title,
    });
    return id;
  };

  /**
   * One edge per person→entity pair. Several records often assert the same
   * relationship in different words ("associated with" / "works as Speaker
   * at"); keeping all of them makes the canvas unreadable, so the most
   * specific wording wins and the rest are dropped.
   */
  const specificity = (label: string): number =>
    (label.includes(' as ') ? 2 : 0) + (label === 'associated with' ? 0 : 1);

  const link = (targetId: string, label: string, confidence: number | null) => {
    const existing = edges.find((e) => e.target === targetId);
    if (existing) {
      if (specificity(label) > specificity(existing.label)) {
        existing.label = label;
        existing.confidence = confidence;
      }
      return;
    }
    edges.push({ id: shortId('edge'), source: personId, target: targetId, label, confidence });
  };

  for (const rec of cluster) {
    if (rec.sourceType === 'public_profile') {
      const id = ensure('profile', rec.source, rec, rec.usernames[0] ?? undefined);
      link(id, 'has public profile', 0.94);
    }
    if (rec.sourceType === 'personal_website') {
      const id = ensure('website', rec.source, rec, 'personal site');
      link(id, 'publishes', 0.8);
    }
    for (const org of rec.organizations) {
      const id = ensure('organization', org, rec, rec.roles[0]);
      link(id, rec.roles[0] ? `works as ${rec.roles[0]} at` : 'associated with', 0.9);
    }
    for (const project of rec.projects) {
      const id = ensure('project', project, rec);
      link(id, 'contributed to', 0.86);
    }
    for (const event of rec.events) {
      const id = ensure('event', event, rec, rec.roles[0]);
      link(id, rec.roles.includes('Speaker') ? 'spoke at' : 'participated in', 0.91);
    }
    for (const pub of rec.publications) {
      const id = ensure('publication', pub, rec);
      link(id, 'authored', 0.88);
    }
  }

  return { nodes, edges };
}
