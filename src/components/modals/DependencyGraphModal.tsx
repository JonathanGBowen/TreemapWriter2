import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  Panel,
  BackgroundVariant,
  Connection,
  ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Section, TestSuite, Dependency } from '../../types';
import { X, Network, RefreshCcw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';

interface DependencyGraphModalProps {
  sections: Section[];
  testSuite: TestSuite;
  updateDependencies: (id: string, deps: Dependency[]) => void;
  onEstimateDependencies?: () => Promise<void>;
}

const nodeWidth = 240;
const nodeHeight = 90;

const SectionNode = ({ data }: any) => {
  const statusColors: Record<string, string> = {
    success: 'text-hld-green',
    fail: 'text-hld-magenta',
    stale: 'text-hld-yellow',
    running: 'text-hld-cyan cursor-wait',
    idle: 'text-hld-muted'
  };

  const statusColor = statusColors[data.status] || 'text-hld-muted';

  return (
    <div className="bg-hld-surface2 border border-hld-cyan hover:border-hld-cyan/100 shadow-[0_0_15px_rgba(0,240,255,0.15)] rounded p-3 w-[240px] h-[90px] font-sans flex flex-col relative group transition-all">
      {/* Target Handle (Top) - Receives dependencies */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-16 h-2 rounded-none bg-hld-cyan border-none -top-1 transition-all hover:h-4 hover:-top-3 cursor-crosshair z-10" 
        title="Receives Dependency (Dependent)"
      />
      
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] uppercase font-mono tracking-widest text-hld-cyan truncate pr-2 max-w-[150px]">
          {data.function}
        </div>
        <div className={`text-[9px] uppercase font-mono tracking-widest ${statusColor}`}>
          [{data.status}]
        </div>
      </div>
      
      <div className="text-sm text-slate-200 mt-1 font-bold truncate line-clamp-2 leading-tight pointer-events-none">
        {data.title}
      </div>

      {/* Source Handle (Bottom) - Provides dependencies */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-16 h-2 rounded-none bg-hld-magenta border-none -bottom-1 transition-all hover:h-4 hover:-bottom-3 cursor-crosshair z-10" 
        title="Provides Dependency (Prerequisite/Ref)"
      />
    </div>
  );
};

const nodeTypes = { sectionNode: SectionNode };

const getLayoutedElements = (nodes: Node[], edges: Edge[], forceDirection?: 'TB' | 'LR') => {
  const tryLayout = (dir: 'TB' | 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: dir, nodesep: 50, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const isHorizontal = dir === 'LR';
    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
      };
    });

    const graphInfo = dagreGraph.graph();
    const width = graphInfo.width || 0;
    const height = graphInfo.height || 0;
    return { nodes: newNodes, edges, width, height, dir };
  };

  const tbLayout = tryLayout('TB');
  const lrLayout = tryLayout('LR');

  if (forceDirection) {
    return forceDirection === 'TB' ? tbLayout : lrLayout;
  }

  // Choose the layout that best matches the screen's aspect ratio
  const screenRatio = window.innerWidth / window.innerHeight;
  const tbRatio = tbLayout.width / (tbLayout.height || 1);
  const lrRatio = lrLayout.width / (lrLayout.height || 1);

  // Compare which aspect ratio is closer to the screen's aspect ratio
  const tbDiff = Math.abs(tbRatio - screenRatio);
  const lrDiff = Math.abs(lrRatio - screenRatio);

  return lrDiff < tbDiff ? lrLayout : tbLayout;
};

export const DependencyGraphModal: React.FC<DependencyGraphModalProps> = ({
  sections,
  testSuite,
  updateDependencies,
  onEstimateDependencies
}) => {
  const isOpen = useStore(s => s.showGraphModal);
  const setShow = useStore(s => s.setShowGraphModal);
  const onClose = () => setShow(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = React.useState<any>(null);
  const prevSectionIds = useRef<string>('');

  const buildData = useCallback(() => {
    const flatSections: Section[] = [];
    const traverse = (nodesToTraverse: Section[]) => {
      nodesToTraverse.forEach(n => {
        flatSections.push(n);
        traverse(n.children);
      });
    };
    traverse(sections);

    const newNodes: Node[] = flatSections.map(s => {
      const entry = testSuite[s.id];
      return {
        id: s.id,
        type: 'sectionNode',
        data: {
          title: s.title,
          function: entry?.spec?.function || 'Unknown',
          status: entry?.status || 'idle'
        },
        position: { x: 0, y: 0 },
        deletable: false, // Prevent deleting nodes from graph
      };
    });

    const newEdges: Edge[] = [];
    flatSections.forEach(s => {
      const entry = testSuite[s.id];
      
      // Implicit parent-child dependency for structure
      if (s.parentId) {
         newEdges.push({
           id: `e-parent-${s.parentId}-${s.id}`,
           source: s.parentId,
           target: s.id,
           animated: false,
           style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1, strokeDasharray: '4 4' },
           interactionWidth: 0, // Unselectable
           deletable: false,
         });
      }

      if (entry?.dependencies) {
        entry.dependencies.forEach(dep => {
          const isPrereq = dep.type === 'prerequisite';
          newEdges.push({
            id: `e-${dep.id}-${s.id}`,
            source: dep.id,
            target: s.id,
            animated: !isPrereq,
            style: {
              stroke: isPrereq ? '#00f0ff' : '#ff0055', // HLD Cyan / Magenta
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isPrereq ? '#00f0ff' : '#ff0055',
            },
            interactionWidth: 20, // Easier to click/hover
            deletable: true,
          });
        });
      }
    });

    return { newNodes, newEdges, sectionIds: flatSections.map(s => s.id).join(',') };
  }, [sections, testSuite]);

  useEffect(() => {
    if (!isOpen) return;

    const { newNodes, newEdges, sectionIds } = buildData();

    if (prevSectionIds.current !== sectionIds) {
       // Deeply changed (number of sections), perform full layout
       prevSectionIds.current = sectionIds;
       const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
       setNodes(layoutedNodes);
       setEdges(layoutedEdges);
       
       if (rfInstance) {
         setTimeout(() => rfInstance.fitView({ padding: 0.1, duration: 800 }), 50);
       }
    } else {
       // Soft sync: preserve node positions, just update data + edges
       setNodes(prev => prev.map(p => {
           const nd = newNodes.find(n => n.id === p.id);
           if (nd) return { ...p, data: nd.data };
           return p;
       }));
       setEdges(newEdges);
    }
  }, [isOpen, buildData, setNodes, setEdges, rfInstance]);
  
  const forceLayout = useCallback(() => {
    const { newNodes, newEdges } = buildData();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    if (rfInstance) {
      setTimeout(() => rfInstance.fitView({ padding: 0.1, duration: 800 }), 50);
    }
    
    toast.success("Graph Layout Optimized.");
  }, [buildData, setNodes, setEdges, rfInstance]);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const { source, target } = params;
      if (!source || !target || source === target) return;
      
      const targetEntry = testSuite[target];
      const existingDeps = targetEntry?.dependencies || [];
      if (existingDeps.some(d => d.id === source)) {
         toast.info("Dependency already exists.");
         return;
      }

      updateDependencies(target, [...existingDeps, { id: source, type: 'prerequisite' }]);
      toast.success("Dependency Added.");
    },
    [testSuite, updateDependencies]
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach(edge => {
        if (edge.id.startsWith('e-parent-')) return; // Ignore structural edges
        const { source, target } = edge;
        const existingDeps = testSuite[target]?.dependencies || [];
        updateDependencies(target, existingDeps.filter(d => d.id !== source));
      });
      toast.success("Dependency Removed.");
    },
    [testSuite, updateDependencies]
  );

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (edge.id.startsWith('e-parent-')) {
        toast.info("Structural hierarchies cannot be modified here.");
        return;
      }
      const { source, target } = edge;
      const existingDeps = testSuite[target]?.dependencies || [];
      const newDeps: Dependency[] = existingDeps.map(d => 
        d.id === source 
          ? { ...d, type: d.type === 'prerequisite' ? ('reference' as const) : ('prerequisite' as const) } 
          : d
      );
      updateDependencies(target, newDeps);
      toast.success("Dependency Type Toggled.");
    },
    [testSuite, updateDependencies]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-hld-bg/95 flex items-center justify-center z-50 p-4 font-sans backdrop-blur-md">
      <div className="bg-hld-surface border border-hld-magenta/50 hover:border-hld-magenta shadow-[0_0_40px_rgba(255,0,85,0.15)] w-full max-w-[95vw] h-[90vh] flex flex-col relative overflow-hidden transition-all duration-300">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-hld-bg to-transparent pointer-events-none">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-hld-cyan/10 border border-hld-cyan/30 rounded hld-glow-cyan">
               <Network className="text-hld-cyan" size={24} />
             </div>
             <div>
               <h3 className="text-2xl font-bold text-hld-text font-mono uppercase tracking-[0.2em] hld-text-glow">
                 Argument Topology
               </h3>
               <p className="text-hld-cyan/70 text-[11px] font-mono uppercase tracking-[0.1em] mt-1">
                 Structural & Logical Dependencies
               </p>
             </div>
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            {onEstimateDependencies && (
              <button 
                onClick={onEstimateDependencies} 
                className="text-hld-magenta hover:text-hld-bg hover:bg-hld-magenta border border-hld-magenta rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-all hld-glow-magenta flex items-center gap-2"
                title="Auto-estimate dependencies via AI"
              >
                Estimate <Wand2 size={14} />
              </button>
            )}
            <button 
              onClick={forceLayout} 
              className="text-hld-cyan hover:text-hld-bg hover:bg-hld-cyan border border-hld-cyan rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-all hld-glow-cyan flex items-center gap-2"
              title="Re-run auto layout"
            >
              Organize Layout <RefreshCcw size={14} />
            </button>
            <button 
              onClick={onClose} 
              className="text-hld-muted hover:text-hld-magenta p-2 transition-colors"
            >
              <X size={32} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 bg-hld-surface2/90 border border-hld-border p-5 backdrop-blur shadow-lg flex flex-col gap-4 font-mono text-[10px] uppercase tracking-widest text-hld-text/70">
           <div className="flex items-center gap-3">
             <div className="w-8 h-0.5 bg-hld-cyan hld-glow-cyan"></div>
             <span>Prerequisite (Structural)</span>
           </div>
           <div className="flex items-center gap-3">
             <div className="w-8 h-0.5 border-t-2 border-dashed border-hld-magenta hld-glow-magenta"></div>
             <span>Reference (Informational)</span>
           </div>
           <div className="flex items-center gap-3">
             <div className="w-8 h-0.5 border-t border-dashed border-slate-500"></div>
             <span>Hierarchy</span>
           </div>
           
           {/* Interaction Hints */}
           <div className="mt-2 text-[9px] text-hld-muted leading-relaxed space-y-1.5">
             <div><strong className="text-hld-cyan">Drag</strong> Handles to connect</div>
             <div><strong className="text-hld-cyan">Double-Click Edge</strong> to toggle type</div>
             <div><strong className="text-hld-magenta">Select & Backspace</strong> to delete</div>
           </div>
        </div>

        {/* Graph Area */}
        <div className="flex-1 w-full h-full pt-16">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            fitView
            className="bg-hld-bg"
            minZoom={0.1}
            maxZoom={1.5}
            connectionMode={ConnectionMode.Strict}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background 
               variant={BackgroundVariant.Dots} 
               gap={24} 
               size={1.5} 
               color="rgba(0, 240, 255, 0.15)" 
            />
            <Controls 
              className="fill-hld-text/70 border-none bg-hld-surface/80 shadow-none [&>button]:!bg-transparent [&>button]:border-b [&>button]:border-hld-border/50 hover:[&>button]:!bg-hld-cyan/20 [&>button]:transition-colors" 
            />
          </ReactFlow>
        </div>

        {/* Screen Glitch / CRT lines (Optional Overlay) */}
        <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCIvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+Cjwvc3ZnPg==')] opacity-50 mix-blend-overlay"></div>
      </div>
    </div>
  );
};
