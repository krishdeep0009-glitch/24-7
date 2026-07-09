import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Clock, Server, Terminal, HelpCircle, Heart, Wifi, RefreshCw } from "lucide-react";
import { MonitoredSite, MonitorStats, PingLog } from "./types";
import StatsGrid from "./components/StatsGrid";
import AddSiteForm from "./components/AddSiteForm";
import SiteCard from "./components/SiteCard";
import HistoryDrawer from "./components/HistoryDrawer";

export default function App() {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [stats, setStats] = useState<MonitorStats>({
    totalSites: 0,
    activeSites: 0,
    onlineSites: 0,
    offlineSites: 0,
    avgResponseTime: 0,
    overallUptime: 100
  });
  
  const [selectedSite, setSelectedSite] = useState<MonitoredSite | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<"logs" | "raw" | "monitor">("logs");
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [time, setTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all sites and system stats
  const fetchData = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      // Fetch sites
      const sitesRes = await fetch("/api/sites");
      if (sitesRes.ok) {
        const sitesData: MonitoredSite[] = await sitesRes.json();
        setSites(sitesData);
        
        // If we have a drawer open, keep its state synced with updated data
        if (selectedSite) {
          const matching = sitesData.find(s => s.id === selectedSite.id);
          if (matching) setSelectedSite(matching);
        }
      }

      // Fetch stats
      const statsRes = await fetch("/api/stats");
      if (statsRes.ok) {
        const statsData: MonitorStats = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Error polling monitoring backend:", err);
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  };

  // Poll server state every 4 seconds to maintain a completely live dashboard experience
  useEffect(() => {
    fetchData(); // initial fetch
    const poller = setInterval(() => fetchData(), 4000);
    return () => clearInterval(poller);
  }, [selectedSite?.id]);

  // Aggregate live terminal system-wide feed
  useEffect(() => {
    const getSystemLogs = async () => {
      try {
        const logsPromises = sites.map(s => fetch(`/api/sites/${s.id}/history`).then(r => r.json()));
        const allLogsResults: PingLog[][] = await Promise.all(logsPromises);
        
        // Flatten and sort by newest first
        const flattened = allLogsResults
          .flat()
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5); // Keep top 5 latest overall events

        const logLines = flattened.map(log => {
          const site = sites.find(s => s.id === log.siteId);
          if (!site) return "";
          const stamp = new Date(log.timestamp).toLocaleTimeString();
          if (log.status === "online") {
            return `[${stamp}] PING SUCCEEDED -> "${site.name}" responded with code ${log.statusCode} in ${log.responseTime}ms`;
          } else {
            return `[${stamp}] PING FAILED -> "${site.name}" unreachable: ${log.statusText}`;
          }
        }).filter(line => line !== "");

        setSystemLogs(logLines);
      } catch (err) {
        console.error("Failed compiling live system-wide log logs:", err);
      }
    };

    if (sites.length > 0) {
      getSystemLogs();
    }
  }, [sites]);

  // Action: Add Site
  const handleAddSite = async (siteData: any) => {
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteData)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to configure target website.");
    }
    
    await fetchData();
  };

  // Action: Delete Site
  const handleDeleteSite = async (id: string) => {
    const res = await fetch(`/api/sites/${id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      if (selectedSite?.id === id) {
        setSelectedSite(null);
      }
      await fetchData();
    }
  };

  // Action: Toggle Active status
  const handleToggleActive = async (id: string) => {
    const res = await fetch(`/api/sites/${id}/toggle`, {
      method: "POST"
    });
    if (res.ok) {
      await fetchData();
    }
  };

  // Action: Force Manual Reset / Immediate Ping Check
  const handleManualPing = async (id: string) => {
    const res = await fetch(`/api/sites/${id}/ping`, {
      method: "POST"
    });
    if (res.ok) {
      await fetchData();
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col font-sans" id="uptime-monitor-root">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 shadow-xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Pulse<span className="text-blue-500">Guard</span> 24/7
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <Wifi className="h-3 w-3 text-emerald-500 animate-pulse shrink-0" />
                <span>Continuous keep-alive engine active</span>
              </div>
            </div>
          </div>

          {/* System Clocks and Refresh State */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">System Active</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-500">UTC:</span>
                <span className="font-mono text-slate-300">{time.toUTCString().slice(17, 25)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">LOCAL:</span>
                <span className="font-mono text-slate-300">{time.toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-2 bg-[#0f172a]/40 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors shadow-xs cursor-pointer flex items-center justify-center text-slate-300"
              title="Force Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 text-slate-400 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Real-time statistics overview panel */}
        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Target configuration form & guide */}
          <div className="lg:col-span-1 space-y-6">
            <AddSiteForm onAdd={handleAddSite} />

            {/* Offline execution trust card */}
            <div className="bg-[#0f172a]/30 backdrop-blur-md border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Server className="h-4 w-4 text-blue-500 animate-pulse" />
                  Offline Keep-Alive Engine
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This keep-alive system runs fully server-side. Once you configure a website or API, our container continuously executes pings at your specified interval—<strong>even if you shut down your device, exit your browser, or are completely offline.</strong>
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/60">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>⚡</span> CodeSandbox 24/7 Solution
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  CodeSandbox containers automatically hibernate after a short period of inactivity. To prevent this and run your sandbox 24/7:
                </p>
                <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside pl-1">
                  <li>Click the <strong className="text-amber-400">CodeSandbox Preset</strong> button above to pre-fill the recommended headers.</li>
                  <li>Replace <code className="bg-slate-950 px-1 py-0.5 rounded text-[10px] text-blue-400 font-mono">YOUR-SANDBOX-ID</code> with your live sandbox ID.</li>
                  <li>Ensure the interval is set to <strong className="text-blue-400">2 minutes</strong>. Our system will make automated visits to keep the sandbox fully spun up and awake.</li>
                </ol>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-800/60">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Scale-awake protection</strong>: Prevent free-tier hosting from sleeping.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Historical logs</strong>: Deep network latency graphs and error tracking.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Instant recovery</strong>: Send headers/POST bodies to trigger app restarts.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Active monitoring targets list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
                Active Monitoring Targets
              </h2>
              <span className="text-xs text-slate-300 bg-slate-900/50 px-2.5 py-1 rounded-full border border-slate-800 font-bold uppercase tracking-wider">
                {sites.length} total target{sites.length === 1 ? "" : "s"}
              </span>
            </div>

            {sites.length === 0 ? (
              <div className="bg-[#0f172a]/20 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-inner">
                <Activity className="h-10 w-10 text-slate-600 animate-pulse mb-3" />
                <h3 className="text-sm font-bold text-slate-400">No sites configured</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                  Add your first website using the configuration panel to initiate 24/7 keep-alive checks.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {sites.map((site) => (
                    <SiteCard
                      key={site.id}
                      site={site}
                      onDelete={handleDeleteSite}
                      onToggle={handleToggleActive}
                      onManualPing={handleManualPing}
                      onViewLogs={(site, tab) => {
                        setSelectedSite(site);
                        if (tab) {
                          setDrawerInitialTab(tab);
                        }
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Global Live System Log Console */}
        <div className="bg-[#020617] text-slate-200 border border-slate-800 rounded-2xl p-5 shadow-2xl shadow-black mt-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-blue-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-slate-300">SYSTEM-WIDE BACKGROUND MONITOR ACTIVITY STREAM</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Streaming Live Events</span>
            </div>
          </div>
          <div className="font-mono text-[11px] leading-relaxed space-y-2 scrollbar-thin max-h-32 overflow-y-auto">
            {systemLogs.length === 0 ? (
              <div className="text-slate-600 italic py-2">[No events compiled yet. Waiting for scheduled triggers...]</div>
            ) : (
              systemLogs.map((logLine, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 shrink-0 select-none">&gt;&gt;</span>
                  <span className={logLine.includes("FAILED") ? "text-rose-400 font-semibold" : "text-emerald-400"}>{logLine}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-[#0f172a]/80 border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <span className="text-slate-400">PulseGuard 24/7</span>
            <span>•</span>
            <span className="text-slate-500">Uptime Engine v1.0.0</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500">
            <span>Tunnel Active</span>
            <div className="w-3 h-3 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
            </div>
          </div>
        </div>
      </footer>

      {/* History Drawer Slider */}
      <AnimatePresence>
        {selectedSite && (
          <HistoryDrawer
            site={selectedSite}
            onClose={() => {
              setSelectedSite(null);
              setDrawerInitialTab("logs");
            }}
            onManualPing={handleManualPing}
            onToggle={handleToggleActive}
            initialTab={drawerInitialTab}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
