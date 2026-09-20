import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Building2,
  CalendarRange,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe2,
  UserCircle2,
  UserSearch,
} from 'lucide-react';
import {
  EmptyState,
  Panel,
  PanelHeader,
  PageHeader,
  ProvenanceTag,
  cx,
} from '../components/ui';
import { RequireInvestigation } from '../components/investigation/RequireInvestigation';
import type { GraphEdge, GraphNode } from '../types';

const TYPE_META: Record<
  GraphNode['type'],
  { icon: typeof UserCircle2; ring: string; text: string; label: string }
> = {
  person: { icon: UserSearch, ring: 'border-violet-core/60 bg-violet-core/[0.16]', text: 'text-violet-soft', label: 'Person' },
  profile: { icon: UserCircle2, ring: 'border-cyan-core/40 bg-cyan-core/[0.1]', text: 'text-cyan-soft', label: 'Profile' },
  organization: { icon: Building2, ring: 'border-emerald-400/40 bg-emerald-400/[0.09]', text: 'text-emerald-300', label: 'Organization' },
  project: { icon: FolderGit2, ring: 'border-amber-400/40 bg-amber-400/[0.09]', text: 'text-amber-300', label: 'Project' },
  event: { icon: CalendarRange, ring: 'border-sky-400/40 bg-sky-400/[0.09]', text: 'text-sky-300', label: 'Event' },
  publication: { icon: FileText, ring: 'border-fuchsia-400/40 bg-fuchsia-400/[0.09]', text: 'text-fuchsia-300', label: 'Publication' },
  website: { icon: Globe2, ring: 'border-slate-400/40 bg-slate-400/[0.09]', text: 'text-slate-300', label: 'Website' },
};

function EntityNode({ data, selected }: NodeProps<GraphNode & { dim: boolean }>) {
  const meta = TYPE_META[data.type];
  const Icon = meta.icon;
  const isPerson = data.type === 'person';

  return (
    <div
      className={cx(
        'rounded-xl border backdrop-blur-sm transition-all duration-200',
        meta.ring,
        isPerson ? 'px-5 py-4 shadow-glow' : 'px-4 py-3',
        selected && 'ring-2 ring-cyan-core/60',
        data.dim && 'opacity-25',
      )}
      style={{ width: isPerson ? 210 : 178 }}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-slate-600" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-slate-600" />
      <div className="flex items-start gap-2.5">
        <Icon size={isPerson ? 18 : 15} className={cx('mt-0.5 shrink-0', meta.text)} />
        <div className="min-w-0">
          <div className={cx('truncate font-semibold leading-tight text-white', isPerson ? 'text-[14px]' : 'text-[12px]')}>
            {data.label}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{meta.label}</div>
          {data.sublabel && (
            <div className="mt-1 truncate text-[10px] text-slate-400">{data.sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

function layout(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const person = nodes.find((n) => n.type === 'person');
  const others = nodes.filter((n) => n.type !== 'person');

  pos[person?.id ?? 'person_root'] = { x: 0, y: 0 };

  // Group by type so related entities sit together on the ring.
  const order: GraphNode['type'][] = ['profile', 'organization', 'project', 'event', 'publication', 'website'];
  const sorted = [...others].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  const count = sorted.length || 1;
  const radiusX = Math.max(420, count * 46);
  const radiusY = Math.max(240, count * 30);

  sorted.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    pos[n.id] = { x: Math.cos(angle) * radiusX, y: Math.sin(angle) * radiusY };
  });

  return pos;
}

function GraphCanvas({ graph }: { graph: { nodes: GraphNode[]; edges: GraphEdge[] } }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const positions = useMemo(() => layout(graph.nodes), [graph.nodes]);

  const connectedIds = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, graph.edges]);

  const initialNodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'entity',
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: { ...n, dim: false },
      })),
    [graph.nodes, positions],
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'rgba(148,163,184,0.35)' },
        labelStyle: { fill: '#94a3b8', fontSize: 10 },
        labelBgStyle: { fill: '#0f121b', fillOpacity: 0.9 },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(148,163,184,0.45)', width: 14, height: 14 },
      })),
    [graph.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Highlight the selected node's neighbourhood.
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        selected: n.id === selectedId,
        data: { ...n.data, dim: connectedIds ? !connectedIds.has(n.id) : false },
      })),
    );
    setEdges((es) =>
      es.map((e) => {
        const active = !selectedId || e.source === selectedId || e.target === selectedId;
        return {
          ...e,
          animated: Boolean(selectedId) && active,
          style: {
            stroke: active ? 'rgba(167,139,250,0.7)' : 'rgba(148,163,184,0.12)',
            strokeWidth: active && selectedId ? 1.8 : 1.4,
          },
          labelStyle: { fill: active ? '#cbd5e1' : '#334155', fontSize: 10 },
        };
      }),
    );
  }, [selectedId, connectedIds, setNodes, setEdges]);

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedEdges = graph.edges.filter((e) => e.target === selectedId || e.source === selectedId);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId((cur) => (cur === node.id ? null : node.id));
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Entity relationships"
          subtitle="Click a node to isolate its connections. Scroll to zoom, drag to pan."
          actions={
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              {(Object.keys(TYPE_META) as GraphNode['type'][]).map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className={cx('h-2 w-2 rounded-sm border', TYPE_META[t].ring)} />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          }
        />
        <div className="h-[600px] bg-ink-950/40">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.25}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(148,163,184,0.16)" />
            <Controls showInteractive={false} className="!border-white/10 !shadow-panel" />
          </ReactFlow>
        </div>
      </Panel>

      <div>
        <Panel className="sticky top-0">
          <PanelHeader
            title={selectedNode ? 'Node detail' : 'Select a node'}
            subtitle={
              selectedNode
                ? undefined
                : 'Click any entity in the graph to see the relationship, evidence, confidence and source behind it.'
            }
          />
          {selectedNode ? (
            <div className="space-y-4 p-5 animate-fade-in">
              <div>
                <div className="label-xs mb-1">Entity</div>
                <div className="text-[15px] font-semibold text-white">{selectedNode.label}</div>
                <div className="mt-1 text-[11px] text-slate-500">{TYPE_META[selectedNode.type].label}</div>
              </div>

              {selectedEdges.map((e) => (
                <div key={e.id}>
                  <div className="label-xs mb-1">Relationship</div>
                  <div className="text-[13px] text-slate-200">{e.label}</div>
                  {e.confidence !== null && e.confidence !== undefined && (
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      confidence {Math.round(e.confidence * 100)}%
                    </div>
                  )}
                </div>
              ))}

              {selectedNode.evidence && (
                <div>
                  <div className="label-xs mb-1">Evidence</div>
                  <p className="border-l-2 border-violet-core/40 pl-3 text-[12px] leading-relaxed text-slate-400">
                    {selectedNode.evidence}
                  </p>
                </div>
              )}

              <div>
                <div className="label-xs mb-1.5">Provenance</div>
                <ProvenanceTag value={selectedNode.provenance} />
              </div>

              {selectedNode.url && (
                <div>
                  <div className="label-xs mb-1">Source</div>
                  <a
                    href={selectedNode.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-start gap-1.5 break-all font-mono text-[11px] text-cyan-soft hover:underline"
                  >
                    <ExternalLink size={10} className="mt-0.5 shrink-0" />
                    {selectedNode.url}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5">
              <div className="space-y-2.5">
                {(Object.keys(TYPE_META) as GraphNode['type'][]).map((t) => {
                  const count = graph.nodes.filter((n) => n.type === t).length;
                  if (!count) return null;
                  const Icon = TYPE_META[t].icon;
                  return (
                    <div key={t} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Icon size={13} className={TYPE_META[t].text} />
                        {TYPE_META[t].label}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums text-slate-300">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-white/[0.07] pt-3 text-[11px] leading-relaxed text-slate-500">
                {graph.nodes.length} node(s) · {graph.edges.length} edge(s). Every edge was produced by a
                retrieved record, not inferred.
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function RelationshipGraph() {
  return (
    <RequireInvestigation>
      {(inv) => (
        <>
          <PageHeader
            eyebrow="Connections"
            title="Relationship Graph"
            subtitle="Person → profiles, organizations, projects, events and publications. Every edge carries the evidence that produced it."
          />
          {inv.graph.nodes.length === 0 ? (
            <EmptyState
              title="No graph to display"
              message="No correlated records were available for this investigation, so no relationships could be established."
            />
          ) : (
            <ReactFlowProvider>
              <GraphCanvas graph={inv.graph} />
            </ReactFlowProvider>
          )}
        </>
      )}
    </RequireInvestigation>
  );
}
