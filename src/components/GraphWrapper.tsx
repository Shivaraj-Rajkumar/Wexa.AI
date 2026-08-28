'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full flex items-center justify-center bg-slate-50 animate-pulse">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-slate-500 font-medium tracking-wide">Rendering Network Graph...</span>
      </div>
    </div>
  )
});

export default function GraphWrapper({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Automatically measure the container width to keep the graph perfectly centered
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Zoom to fit the graph nicely in the center when the data loads
  useEffect(() => {
    if (fgRef.current && dimensions.width > 0 && data?.nodes?.length > 0) {
       // Push nodes further apart so arrows in the middle of the line are far from the text
       fgRef.current.d3Force('charge').strength(-500); 
       fgRef.current.d3Force('link').distance(100);
       
       // Timeout allows the physics engine to settle the nodes first before zooming to fit
       const timer = setTimeout(() => {
         fgRef.current?.zoomToFit(400, 60); // 400ms transition, 60px padding
       }, 800);
       return () => clearTimeout(timer);
    }
  }, [data, dimensions.width]);

  if (!data || data.nodes.length === 0) return null;

  return (
    <div ref={containerRef} className="h-[500px] w-full bg-slate-50 overflow-hidden relative">
      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeRelSize={6}
          linkColor={() => '#cbd5e1'}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={0.5}
          linkWidth={1.5}
          d3VelocityDecay={0.3}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.id;
            const fontSize = Math.max(12 / globalScale, 4); // Keep legible when zoomed out
            ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            
            const isDb = node.label === 'Database';
            const bgColor = isDb ? '#f43f5e' : '#6366f1'; // rose-500 : indigo-500
            
            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
            ctx.fillStyle = bgColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / globalScale;
            ctx.stroke();

            const bgY = node.y + 12; // Position text slightly below the node

            // Draw Text Halo (Outline) so it's readable over lines but doesn't block them with a huge box
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 4 / globalScale;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeText(label, node.x, bgY);
            
            // Draw Text
            ctx.fillStyle = '#1e293b'; // slate-800
            ctx.fillText(label, node.x, bgY);
          }}
        />
      )}
    </div>
  );
}
