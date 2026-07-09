import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, Clock, Terminal, Globe, ShieldAlert, FileText, Download, Check, HelpCircle, Activity, RefreshCw, Lock, Unlock, ExternalLink, Monitor, Play, Pause } from "lucide-react";
import { MonitoredSite, PingLog } from "../types";

interface HistoryDrawerProps {
  site: MonitoredSite | null;
  onClose: () => void;
  onManualPing: (id: string) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
  initialTab?: "logs" | "raw" | "monitor";
}

export default function HistoryDrawer({ site, onClose, onManualPing, onToggle, initialTab = "logs" }: HistoryDrawerProps) {
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "raw" | "monitor">(initialTab);

  const [iframeKey, setIframeKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(120);
  const [refreshCountdown, setRefreshCountdown] = useState(120);
  const [totalRefreshes, setTotalRefreshes] = useState(0);

  // Automatically activate 24/7 background keep-alive monitoring and trigger a wake-up ping when entering the monitor tab
  useEffect(() => {
    if (activeTab === "monitor" && site) {
      // If currently paused/inactive, unpause it so that the 24/7 background worker starts running instantly
      if (!site.isActive) {
        onToggle(site.id).catch(err => console.error("Failed to auto-resume background worker:", err));
      }
      // Fire an immediate wake-up ping right away to wake CodeSandbox instantly
      onManualPing(site.id).catch(err => console.error("Failed to trigger immediate wake-up ping:", err));
    }
  }, [activeTab, site?.id]);

  // Sync active tab with initialTab prop
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, site?.id]);

  // Auto-refresh countdown effect
  useEffect(() => {
    if (!autoRefresh || activeTab !== "monitor" || !site) return;
    
    const intervalId = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          // Trigger reload
          setIframeKey((k) => k + 1);
          setTotalRefreshes((r) => r + 1);
          return refreshInterval; // reset to chosen interval
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, activeTab, site?.id, refreshInterval]);

  // Reset countdown if auto-refresh, activeTab, or refreshInterval changes
  useEffect(() => {
    if (autoRefresh && activeTab === "monitor") {
      setRefreshCountdown(refreshInterval);
    }
  }, [autoRefresh, activeTab, refreshInterval]);

  const handleForceReloadIframe = () => {
    setIframeKey((k) => k + 1);
    setTotalRefreshes((r) => r + 1);
    if (autoRefresh) {
      setRefreshCountdown(refreshInterval);
    }
  };

  const fetchHistory = async () => {
    if (!site) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sites/${site.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error loading detailed history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (site) {
      fetchHistory();
    }
  }, [site, site?.lastChecked]);

  if (!site) return null;

  const handleManualPing = async () => {
    setIsPinging(true);
    try {
      await onManualPing(site.id);
      await fetchHistory();
    } finally {
      setIsPinging(false);
    }
  };

  const exportToJson = () => {
    const filename = `${site.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-logs.json`;
    const jsonStr = JSON.stringify({ site, logs }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Build SVG Path for response times
  const buildLatencyChart = () => {
    // Show last 15 checks
    const chartLogs = logs.slice(0, 15).reverse();
    if (chartLogs.length < 2) {
      return (
        <div className="h-32 flex items-center justify-center border border-dashed border-zinc-200 rounded-lg text-xs text-zinc-400 italic">
          Gathering monitoring metrics... (Requires at least 2 checks)
        </div>
      );
    }

    const width = 500;
    const height = 120;
    const padding = 20;

    const latencies = chartLogs.map(l => l.status === "online" ? l.responseTime : 0);
    const maxLat = Math.max(...latencies, 100); // at least 100ms max ceiling

    const points = chartLogs.map((log, idx) => {
      const x = padding + (idx * (width - padding * 2)) / (chartLogs.length - 1);
      // invert Y since SVG 0,0 is top-left
      const y = height - padding - ((log.status === "online" ? log.responseTime : 0) / maxLat) * (height - padding * 2);
      return { x, y, log };
    });

    // Generate SVG path strings
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="bg-[#0f172a]/20 rounded-2xl border border-slate-800 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
            <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
            Response Latency (ms) - Last 15 checks
          </span>
          <span className="text-[10px] font-mono text-slate-500">Max: {maxLat}ms</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e293b" strokeWidth="1" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1e293b" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1.5" />

          {/* Chart area and line */}
          <path d={areaPath} fill="url(#latencyGradient)" opacity="0.15" />
          <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Gradients */}
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Data Nodes */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill={p.log.status === "online" ? "#2563eb" : "#ef4444"}
                stroke="#020617"
                strokeWidth="1.5"
              />
              {/* Tooltip background on hover */}
              <rect
                x={p.x - 30}
                y={p.y - 28}
                width="60"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#1e293b"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              />
              <text
                x={p.x}
                y={p.y - 16}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              >
                {p.log.status === "online" ? `${p.log.responseTime}ms` : "Down"}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" id="drawer-overlay">
      {/* Dim backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer content */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="relative w-full max-w-xl bg-[#020617] h-full border-l border-slate-800 shadow-2xl flex flex-col z-10"
        id="drawer-body"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500 shrink-0" />
              {site.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono truncate select-all">{site.url}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Belt */}
        <div className="px-6 py-3 bg-[#0f172a]/30 border-b border-slate-800 flex gap-2 items-center justify-between">
          <div className="flex gap-1.5 text-xs text-slate-400 font-bold items-center uppercase tracking-wider">
            <span className="flex h-2 w-2 relative">
              {site.status === "online" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${site.status === "online" ? "bg-emerald-500" : site.status === "offline" ? "bg-rose-500" : "bg-slate-550"}`}></span>
            </span>
            <span className="capitalize">{site.status}</span>
            <span>•</span>
            <span>Uptime: {site.uptimePercentage}%</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualPing}
              disabled={isPinging || !site.isActive}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-800 bg-[#0f172a]/40 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer ${
                !site.isActive ? "opacity-35 cursor-not-allowed" : ""
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${isPinging ? "animate-spin text-blue-400" : ""}`} />
              Reset & Ping Now
            </button>
            <button
              onClick={exportToJson}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-800 bg-[#0f172a]/40 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3 w-3 text-blue-400" />
              Export
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Custom Latency Chart */}
          {buildLatencyChart()}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0f172a]/30 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">Success rate</span>
              <span className="text-sm font-bold text-emerald-400">{site.uptimePercentage}%</span>
            </div>
            <div className="bg-[#0f172a]/30 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pings Executed</span>
              <span className="text-sm font-bold text-white">{site.totalChecks}</span>
            </div>
            <div className="bg-[#0f172a]/30 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last latency</span>
              <span className="text-sm font-bold text-white">{site.lastResponseTime ? `${site.lastResponseTime}ms` : "-"}</span>
            </div>
            <div className="bg-[#0f172a]/30 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">HTTP Code</span>
              <span className={`text-sm font-bold ${site.lastStatusCode && site.lastStatusCode < 400 ? "text-emerald-400" : "text-rose-400"}`}>
                {site.lastStatusCode || "-"}
              </span>
            </div>
          </div>

          {/* Request Config Details */}
          <div className="bg-[#0f172a]/20 rounded-xl border border-slate-800 overflow-hidden">
            <div className="bg-[#0f172a]/50 px-4 py-2.5 border-b border-slate-800/80 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">HTTP Configuration Rules</span>
            </div>
            <table className="w-full text-xs text-left text-slate-300 border-collapse">
              <tbody>
                <tr className="border-b border-slate-800/60">
                  <td className="px-4 py-2 font-bold uppercase tracking-wide bg-[#0f172a]/40 w-1/3 text-slate-400">Request Method</td>
                  <td className="px-4 py-2 font-mono text-blue-400 font-semibold">{site.method}</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="px-4 py-2 font-bold uppercase tracking-wide bg-[#0f172a]/40 text-slate-400">Request Timeout</td>
                  <td className="px-4 py-2">{site.timeout / 1000} seconds</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="px-4 py-2 font-bold uppercase tracking-wide bg-[#0f172a]/40 text-slate-400">Monitor ID</td>
                  <td className="px-4 py-2 font-mono text-slate-500 select-all">{site.id}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-bold uppercase tracking-wide bg-[#0f172a]/40 text-slate-400">Headers</td>
                  <td className="px-4 py-2 text-slate-400">
                    {site.headers.length === 0 ? (
                      <span className="text-slate-500 italic">None configured</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 font-mono text-[10px] text-slate-400 bg-[#020617] p-1.5 rounded border border-slate-800">
                        {site.headers.map((h, idx) => (
                          <div key={idx}>
                            <span className="font-bold text-slate-300">{h.key}:</span> {h.value}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Drawer Tabs */}
          <div className="border-b border-slate-800">
            <nav className="flex gap-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("logs")}
                className={`pb-3 text-sm font-bold border-b-2 px-1 cursor-pointer transition-all ${
                  activeTab === "logs"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Uptime Log History
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`pb-3 text-sm font-bold border-b-2 px-1 cursor-pointer transition-all ${
                  activeTab === "raw"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Raw Event Console
              </button>
              <button
                onClick={() => setActiveTab("monitor")}
                className={`pb-3 text-sm font-bold border-b-2 px-1 cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "monitor"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Monitor className="h-4 w-4" />
                Live Frame Monitor
              </button>
            </nav>
          </div>

          {/* Tab Panes */}
          {activeTab === "logs" ? (
            <div className="space-y-3">
              {isLoading && logs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">Loading history logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 italic">No uptime logs available yet. Checks will record here.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left text-slate-300 border-collapse">
                    <thead className="bg-[#0f172a]/40 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Checked at</th>
                        <th className="px-4 py-2.5">Uptime State</th>
                        <th className="px-4 py-2.5">Latency</th>
                        <th className="px-4 py-2.5">HTTP Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-800/60 hover:bg-[#0f172a]/20">
                          <td className="px-4 py-2.5 font-medium text-slate-300">
                            {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 font-bold ${log.status === "online" ? "text-emerald-400" : "text-rose-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${log.status === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                              {log.status === "online" ? "ONLINE" : "OFFLINE"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-400">{log.responseTime}ms</td>
                          <td className="px-4 py-2.5 font-mono">
                            <span className={`font-bold ${log.statusCode && log.statusCode < 400 ? "text-emerald-400" : "text-rose-400"}`} title={log.statusText}>
                              {log.statusCode || "ERR"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === "raw" ? (
            /* Raw Terminal Logs */
            <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[11px] h-72 overflow-y-auto border border-slate-800 shadow-inner flex flex-col space-y-1.5 scrollbar-thin">
              <div className="text-slate-500 flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-2">
                <Terminal className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-bold">24/7 BACKGROUND MONITORING RAW SHELL CONSOLE</span>
              </div>
              {logs.length === 0 ? (
                <span className="text-slate-600 italic">[Waiting for incoming network events...]</span>
              ) : (
                logs.slice().reverse().map((log) => {
                  const stamp = new Date(log.timestamp).toISOString();
                  const reqLine = `[${stamp}] OUT -> ${site.method} ${site.url}`;
                  const respLine = log.status === "online"
                    ? `[${stamp}] RESP <- SUCCESS: HTTP ${log.statusCode} ${log.statusText} (${log.responseTime}ms, size: ${log.responseSize || 0}B)`
                    : `[${stamp}] RESP <- FAILURE: HTTP ${log.statusCode || "NULL"} - ${log.statusText} (${log.responseTime}ms)`;

                  return (
                    <div key={log.id} className="space-y-0.5 border-b border-slate-900/60 pb-1.5">
                      <div className="text-slate-400">{reqLine}</div>
                      <div className={log.status === "online" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        {respLine}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Live Iframe Monitor with 2m auto-refresh */
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-slate-300 flex items-start gap-2.5 shadow-sm">
                <HelpCircle className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                    Continuous Wake Tunnel Active
                  </h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Our background server executes active keep-alive visits to this URL every 2 minutes. If this website has security headers (such as CSP) that block frame embedding in browsers, the preview frame below might stay blank—but the 24/7 background keep-alive visits remain fully active!
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 font-bold px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Direct Site
                    </a>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Refreshes: {totalRefreshes} | Interval: 2 min
                    </span>
                  </div>
                </div>
              </div>

              {/* SPECIAL CODESANDBOX WAKE GUIDE ALERT */}
              {(site.url.includes("codesandbox") || site.url.includes("csb.app")) && (
                <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-4 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span>🔓</span>
                    <span>Make your CodeSandbox Port "Public" to stay online 24/7!</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    By default, your CodeSandbox port is **Private** and blocks external keep-alive visits with a login screen. Once blocked, the microVM goes to sleep. Changing it to **Public** allows our server to ping it successfully:
                  </p>
                  <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] leading-relaxed text-slate-300">
                    <div>
                      <span className="font-bold text-amber-400 block mb-1">1. Look Down-Right</span>
                      In your CodeSandbox project editor, locate the bottom-right panel labeled <strong className="text-white">Ports</strong> or <strong className="text-white">Previews</strong>.
                    </div>
                    <div>
                      <span className="font-bold text-amber-400 block mb-1">2. Click "Private" Badge</span>
                      Find the active port (e.g., <strong className="text-white">3000</strong>) and click the red <strong className="text-rose-400 font-bold">🔒 Private</strong> tag.
                    </div>
                    <div>
                      <span className="font-bold text-amber-400 block mb-1">3. Select "Public" 🔓</span>
                      Switch it to <strong className="text-emerald-400 font-bold">🔓 Public</strong>. This allows our 24/7 ping server to connect and keep your panel awake permanently!
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIAL GITHUB CODESPACES WAKE GUIDE ALERT */}
              {(site.url.includes("github.dev") || site.url.includes("app.github.dev")) && (
                <div className="bg-indigo-500/10 border border-indigo-500/35 rounded-xl p-4 text-xs text-indigo-200 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span>🔓</span>
                    <span>Make your Codespaces Port "Public" to stay online 24/7!</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    By default, your GitHub Codespace forwarded ports are **Private** and block keep-alive pings with a GitHub authentication screen. Changing the port visibility to **Public** allows our server to connect successfully:
                  </p>
                  <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] leading-relaxed text-slate-300">
                    <div>
                      <span className="font-bold text-indigo-400 block mb-1">1. Open Ports Panel</span>
                      In your Codespace editor, look at the bottom area and switch to the <strong className="text-white">Ports</strong> tab (next to Terminal).
                    </div>
                    <div>
                      <span className="font-bold text-indigo-400 block mb-1">2. Hover Port Visibility</span>
                      Find your web server port (e.g. <strong className="text-white">3000</strong>) and right-click it, or click its Port Visibility column.
                    </div>
                    <div>
                      <span className="font-bold text-indigo-400 block mb-1">3. Select "Public" 🔓</span>
                      Change Port Visibility from <strong className="text-rose-400 font-bold">🔒 Private</strong> to <strong className="text-emerald-400 font-bold">🔓 Public</strong>. Your panel is now active 24/7!
                    </div>
                  </div>
                </div>
              )}

              {/* Mock Browser Container */}
              <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                {/* Mock Browser Title Bar */}
                <div className="bg-[#020617] px-4 py-3 flex items-center justify-between border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  
                  {/* Address bar */}
                  <div className="mx-4 bg-[#0f172a] px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2 text-xs text-slate-300 font-mono w-full max-w-sm justify-between truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      {site.url.startsWith("https") ? (
                        <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate select-all">{site.url}</span>
                    </div>
                    <button 
                      onClick={handleForceReloadIframe}
                      title="Force refresh frame now"
                      className="p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  
                  {/* Auto-Refresh Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={autoRefresh ? refreshInterval : 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val === 0) {
                          setAutoRefresh(false);
                        } else {
                          setAutoRefresh(true);
                          setRefreshInterval(val);
                        }
                      }}
                      className="bg-[#0f172a] text-slate-300 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500 cursor-pointer transition-all"
                    >
                      <option value="0">⏹️ Paused</option>
                      <option value="10">⚡ 10 Seconds (Quick Boot)</option>
                      <option value="30">⏰ 30 Seconds (Fast Reload)</option>
                      <option value="60">⏱️ 1 Minute (Active Monitor)</option>
                      <option value="120">🔄 2 Minutes (Standard)</option>
                      <option value="300">⏳ 5 Minutes (Slow Mode)</option>
                      <option value="600">🔋 10 Minutes (Low Power)</option>
                    </select>
                  </div>
                </div>

                {/* Sub Bar with countdown details */}
                {autoRefresh && (
                  <div className="bg-[#0f172a]/30 px-4 py-2 border-b border-slate-800/60 flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-400" />
                      Next automatic page reload in <strong className="text-blue-400 font-bold">{refreshCountdown}s</strong>
                    </span>
                    <span>Interval matched to keep-alive visits</span>
                  </div>
                )}

                {/* Live Frame viewport */}
                <div className="relative bg-white h-96 w-full">
                  <iframe
                    key={iframeKey}
                    src={`${site.url}${site.url.includes("?") ? "&" : "?"}__live_monitor_cb=${iframeKey}`}
                    className="w-full h-full bg-white"
                    title={`Live Viewport Monitor - ${site.name}`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
