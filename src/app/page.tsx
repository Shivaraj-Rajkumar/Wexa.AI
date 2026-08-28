'use client';
import { useState, useEffect } from 'react';
import CustomDropdown from '@/components/CustomDropdown';
import GraphWrapper from '@/components/GraphWrapper';
import { AlertCircle, Activity, Users, AlertTriangle, Layers, Zap, Search, Gauge, Waypoints } from 'lucide-react';

export default function Home() {
  const [components, setComponents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [mode, setMode] = useState<'blast' | 'root'>('blast');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    fetch('/api/components')
      .then(res => {
         if (!res.ok) throw new Error('Database unreachable');
         return res.json();
      })
      .then(data => {
         if (data.error) throw new Error(data.error);
         setComponents(data);
      })
      .catch(err => {
         setDbError(true);
      });
  }, []);

  const handleAnalyze = async () => {
    if (!selected) return;
    const comp = components.find(c => c.name === selected);
    if (!comp) return;

    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/blast-radius?name=${encodeURIComponent(comp.name)}&type=${encodeURIComponent(comp.type)}&mode=${mode}`);
      if (!res.ok) throw new Error('Failed to fetch blast radius');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [pageModal, setPageModal] = useState<{isOpen: boolean, team: string, pager: string}>({ isOpen: false, team: '', pager: '' });

  const affectedServicesCount = data?.tableData?.length || 0;
  const affectedTeamsCount = new Set(data?.tableData?.map((r: any) => r.team)).size || 0;
  const criticalServices = data?.tableData?.filter((r: any) => r.tier === 1).length || 0;

  // --- Score Calculation ---
  let impactScore = 0;
  if (data?.tableData) {
    const t2 = data.tableData.filter((r: any) => r.tier === 2).length;
    const t3 = data.tableData.filter((r: any) => r.tier === 3).length;
    impactScore += criticalServices * 20; // Tier 1
    impactScore += t2 * 10;
    impactScore += t3 * 5;
    impactScore += affectedTeamsCount * 5;
  }
  const displayScore = Math.min(impactScore, 100);
  let scoreColor = 'text-emerald-600 bg-emerald-50';
  let scoreSeverity = 'LOW SEVERITY';
  if (displayScore > 40) { scoreColor = 'text-amber-600 bg-amber-50'; scoreSeverity = 'MEDIUM SEVERITY'; }
  if (displayScore > 75) { scoreColor = 'text-rose-600 bg-rose-50'; scoreSeverity = 'HIGH SEVERITY'; }

  // --- Critical Path Extraction ---
  let criticalPath = '';
  if (data?.graphData?.links && data.graphData.links.length > 0) {
    const nodes = new Set<string>();
    data.graphData.links.forEach((l: any) => {
      nodes.add(typeof l.source === 'object' ? l.source.id : l.source);
      nodes.add(typeof l.target === 'object' ? l.target.id : l.target);
    });

    let globalMaxPath: string[] = [];
    
    const dfs = (current: string, currentPath: string[]) => {
      if (currentPath.length > globalMaxPath.length) {
        globalMaxPath = [...currentPath];
      }
      const outgoing = data.graphData.links.filter((l: any) => 
        (typeof l.source === 'object' ? l.source.id : l.source) === current
      );
      for (const link of outgoing) {
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        if (!currentPath.includes(target)) {
          dfs(target, [...currentPath, target]);
        }
      }
    };

    Array.from(nodes).forEach(node => dfs(node, [node]));
    
    // In blast radius, dependencies flow downstream, so the path is naturally Upstream -> Downstream
    criticalPath = globalMaxPath.join(' → ');
  }

  return (
    <main className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* Sleek Header */}
      <header className="bg-slate-900 text-white py-8 px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
              <Activity className="mr-3 h-8 w-8 text-rose-500" />
              Blast Radius Analyzer
            </h1>
            <p className="text-slate-400 mt-2 font-medium">Predictive infrastructure outage and dependency mapping</p>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dbError ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${dbError ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-sm font-semibold text-slate-300">{dbError ? 'System Offline' : 'System Online'}</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        
        {dbError && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 animate-in fade-in zoom-in-95">
             <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0" />
             <p className="text-rose-700 font-medium">Database connection failed. Please ensure CognoDB credentials are set in <code className="bg-rose-100 px-1 py-0.5 rounded text-rose-800">.env.local</code> and the instance is running.</p>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
             <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide">Select Component to Analyze</label>
             <div className="flex bg-slate-100 p-1.5 rounded-xl shadow-inner mt-3 md:mt-0">
               <button 
                 onClick={() => { setMode('blast'); setData(null); }}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${mode === 'blast' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <Zap className={`h-4 w-4 ${mode === 'blast' ? 'text-rose-500' : 'text-slate-400'}`} />
                 <span>Blast Radius (Impact)</span>
               </button>
               <button 
                 onClick={() => { setMode('root'); setData(null); }}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${mode === 'root' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <Search className={`h-4 w-4 ${mode === 'root' ? 'text-indigo-500' : 'text-slate-400'}`} />
                 <span>Root Cause (Upstream)</span>
               </button>
             </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <CustomDropdown
                components={components}
                selected={selected}
                onSelect={(val) => { setSelected(val); setData(null); setError(''); }}
                disabled={loading}
              />
              <button 
                onClick={handleAnalyze} 
                disabled={!selected || loading}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center flex-shrink-0"
              >
                {loading ? (
                   <span className="flex items-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div> Analyzing...</span>
                ) : 'Analyze Impact'}
              </button>
          </div>
          {error && <p className="mt-4 text-rose-500 text-sm font-medium flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> {error}</p>}
        </div>

        {data && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center">
                 <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl mr-5"><Layers className="h-8 w-8" /></div>
                 <div>
                   <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{mode === 'blast' ? 'Affected Services' : 'Upstream Services'}</p>
                   <p className="text-3xl font-extrabold text-slate-900">{affectedServicesCount}</p>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center">
                 <div className="p-4 bg-rose-50 text-rose-600 rounded-xl mr-5"><AlertTriangle className="h-8 w-8" /></div>
                 <div>
                   <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Critical (Tier 1)</p>
                   <p className="text-3xl font-extrabold text-slate-900">{criticalServices}</p>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center">
                 <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl mr-5"><Users className="h-8 w-8" /></div>
                 <div>
                   <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Teams to Page</p>
                   <p className="text-3xl font-extrabold text-slate-900">{affectedTeamsCount}</p>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center relative group cursor-help">
                 <div className={`p-4 rounded-xl mr-5 ${scoreColor}`}><Gauge className="h-8 w-8" /></div>
                 <div>
                   <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center">
                     Impact Score
                     <span className="ml-2 text-slate-400 group-hover:text-indigo-500 transition-colors bg-slate-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">i</span>
                   </p>
                   <p className="text-3xl font-extrabold text-slate-900">{displayScore} <span className="text-sm font-normal text-slate-500">/ 100</span></p>
                   <p className={`text-xs font-bold mt-1 ${scoreColor.split(' ')[0]}`}>{scoreSeverity}</p>
                 </div>
                 {/* Tooltip */}
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-800 text-white text-xs rounded-lg py-3 px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                   <p className="font-bold mb-2 border-b border-slate-600 pb-1">Score Calculation Formula:</p>
                   <ul className="list-disc pl-4 space-y-1 text-slate-300 mb-2">
                     <li>Each Tier 1 Service: <span className="text-emerald-400 font-bold">+20</span></li>
                     <li>Each Tier 2 Service: <span className="text-emerald-400 font-bold">+10</span></li>
                     <li>Each Tier 3 Service: <span className="text-emerald-400 font-bold">+5</span></li>
                     <li>Each Team Paged: <span className="text-emerald-400 font-bold">+5</span></li>
                   </ul>
                   <p className="text-[10px] text-slate-400 italic">* Final score is capped at 100</p>
                   <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex flex-col mb-2">
                   <h2 className="text-xl font-bold text-slate-800 flex items-center mb-3">
                      {mode === 'blast' ? 'Cascading Impact List' : 'Upstream Dependencies'}
                   </h2>
                   {criticalPath && (
                     <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm font-medium text-indigo-800 break-words flex items-start shadow-sm">
                       <Waypoints className="h-5 w-5 mr-3 text-indigo-500 shrink-0 mt-0.5" /> 
                       <div>
                         <span className="font-bold uppercase tracking-wider text-xs block text-indigo-500 mb-1">Critical Dependency Path</span>
                         {criticalPath}
                       </div>
                     </div>
                   )}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Service</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tier</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Team Pager</th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {data.tableData.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-500 text-base font-medium">✨ {mode === 'blast' ? 'No downstream impact found. This component is safely isolated at the edge.' : 'No upstream dependencies found. This component is at the root level.'}</td></tr>
                      ) : (
                        data.tableData.map((row: any) => (
                          <tr key={row.service} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-sm font-bold text-slate-900 break-words max-w-[150px]">{row.service}</td>
                            <td className="px-4 py-4 text-sm text-slate-500">
                               <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${row.tier === 1 ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                                  Tier {row.tier}
                               </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                               <button 
                                 onClick={() => setPageModal({ isOpen: true, team: row.team, pager: row.pager })}
                                 className="inline-flex items-center space-x-1.5 text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors border border-indigo-100 shadow-sm text-xs max-w-full"
                               >
                                 <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                 <span className="text-left leading-tight whitespace-normal">{row.team}</span>
                               </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                 </div>
                </div>
              </div>
              
              <div className="space-y-4">
                 <h2 className="text-xl font-bold text-slate-800">Dependency Graph</h2>
                 <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                   <GraphWrapper data={data.graphData} />
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Page Modal */}
      {pageModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 mb-6 mx-auto shadow-inner">
                <AlertCircle className="h-8 w-8 text-rose-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-center text-slate-900 mb-3">Page Sent!</h3>
              <p className="text-base text-slate-600 text-center leading-relaxed">
                Incident notification was successfully routed to the <strong className="text-slate-900">{pageModal.team}</strong> team via <code className="bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-800 text-sm border border-slate-200 font-mono">{pageModal.pager}</code>.
              </p>
            </div>
            <div className="bg-slate-50 px-8 py-5 flex justify-center border-t border-slate-100">
              <button
                onClick={() => setPageModal({ isOpen: false, team: '', pager: '' })}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl w-full transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
