import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Trash2, Play, Pause, RefreshCw, Globe, ArrowRight, ExternalLink, Activity } from "lucide-react";
import { MonitoredSite, PingLog } from "../types";

interface SiteCardProps {
  key?: string;
  site: MonitoredSite;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
  onManualPing: (id: string) => Promise<void>;
  onViewLogs: (site: MonitoredSite, initialTab?: "logs" | "raw" | "monitor") => void;
}

export default function SiteCard({ site, onDelete, onToggle, onManualPing, onViewLogs }: SiteCardProps) {
  const [history, setHistory] = useState<PingLog[]>([]);
  const [isPinging, setIsPinging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch individual ping log history for the status bar
  const fetchLocalHistory = async () => {
    try {
      const res = await fetch(`/api/sites/${site.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.slice(0, 24).reverse()); // Take latest 24, show in chronological order
      }
    } catch (err) {
      console.error("Error loading local card history:", err);
    }
  };

  useEffect(() => {
    if (site.isActive) {
      fetchLocalHistory();
      // Poll history for this card periodically
      const interval = setInterval(fetchLocalHistory, 15000);
      return () => clearInterval(interval);
    } else {
      setHistory([]);
    }
  }, [site.id, site.isActive, site.lastChecked]);

  const handleManualPingAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinging(true);
    try {
      await onManualPing(site.id);
      await fetchLocalHistory();
    } finally {
      setIsPinging(false);
    }
  };

  const handleToggleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsToggling(true);
    try {
      await onToggle(site.id);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to stop monitoring and delete "${site.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(site.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Build the 24-bar history grid
  const historyBars = [];
  const maxBars = 24;
  
  for (let i = 0; i < maxBars; i++) {
    // Fill backwards or default to empty
    const logIdx = history.length - maxBars + i;
    const log = logIdx >= 0 ? history[logIdx] : null;

    if (!site.isActive) {
      historyBars.push({ status: "paused", time: "", label: "Paused" });
    } else if (log) {
      historyBars.push({
        status: log.status,
        time: new Date(log.timestamp).toLocaleTimeString(),
        label: `${log.status === "online" ? "Online" : "Offline"} at ${new Date(log.timestamp).toLocaleTimeString()} (${log.responseTime}ms)`
      });
    } else {
      historyBars.push({ status: "pending", time: "", label: "Pending check" });
    }
  }

  const getStatusBadge = () => {
    switch (site.status) {
      case "online":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        );
      case "offline":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            Offline
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-800">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" />
            Pending
          </span>
        );
    }
  };

  const formatInterval = (ms: number) => {
    const mins = ms / 60000;
    if (mins < 1) return `${ms / 1000} seconds`;
    return `every ${mins} min${mins > 1 ? "s" : ""}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`bg-[#0f172a]/40 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 hover:shadow-2xl hover:shadow-black transition-all overflow-hidden cursor-pointer ${
        site.status === "offline" ? "border-l-4 border-l-rose-500" : site.status === "online" ? "border-l-4 border-l-emerald-500" : ""
      }`}
      onClick={() => onViewLogs(site)}
      id={`site-card-${site.id}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-white truncate" title={site.name}>
                {site.name}
              </h3>
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-slate-500 hover:text-blue-400 inline-flex transition-colors"
                title="Open website in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-400 font-mono truncate select-all">{site.url}</p>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Visual Ping History Bars */}
        <div className="my-4">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">
            <span>Uptime History</span>
            <span className="font-bold text-slate-200">{site.uptimePercentage}%</span>
          </div>
          <div className="flex gap-0.5 h-6 w-full items-center">
            {historyBars.map((bar, i) => {
              let bgClass = "bg-slate-800";
              if (bar.status === "online") bgClass = "bg-emerald-500 hover:bg-emerald-400";
              if (bar.status === "offline") bgClass = "bg-rose-500 hover:bg-rose-400";
              if (bar.status === "paused") bgClass = "bg-slate-800/50";
              if (bar.status === "pending") bgClass = "bg-amber-500";

              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-[2px] transition-colors ${bgClass}`}
                  title={bar.label}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            <span>24 checks ago</span>
            <span>Just now</span>
          </div>
        </div>

        {/* Grid Stats */}
        <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-center">
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Uptime</span>
            <span className="text-xs font-bold font-sans text-slate-200">{site.uptimePercentage}%</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Latency</span>
            <span className="text-xs font-bold font-sans text-slate-200">
              {site.status === "paused" ? "-" : site.lastResponseTime ? `${site.lastResponseTime}ms` : "Pending"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Interval</span>
            <span className="text-xs font-semibold text-slate-400 truncate block px-1" title={formatInterval(site.interval)}>
              {site.interval / 60000} min
            </span>
          </div>
        </div>
      </div>

      {/* Footer / Interactive Actions */}
      <div className="bg-[#0f172a]/60 border-t border-slate-800/80 px-5 py-3 flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewLogs(site, "logs");
            }}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Logs
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewLogs(site, "monitor");
            }}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors border-l border-slate-800 pl-3"
            title="Open Live Website Frame Monitor with Auto-Refresh"
          >
            <Globe className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            Live Monitor
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Pause/Play */}
          <button
            onClick={handleToggleAction}
            disabled={isToggling}
            className={`p-1.5 rounded-md border border-slate-800 text-slate-400 hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer ${
              site.isActive ? "hover:text-amber-400" : "hover:text-emerald-400"
            }`}
            title={site.isActive ? "Pause monitoring" : "Resume 24/7 monitoring"}
          >
            {isToggling ? (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : site.isActive ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Trigger Reset / Manual Ping */}
          <button
            onClick={handleManualPingAction}
            disabled={isPinging || !site.isActive}
            className={`p-1.5 rounded-md border border-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer ${
              !site.isActive ? "opacity-35 cursor-not-allowed" : ""
            }`}
            title="Trigger immediate reset/ping check"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? "animate-spin text-blue-400" : ""}`} />
          </button>

          {/* Delete Monitor */}
          <button
            onClick={handleDeleteAction}
            disabled={isDeleting}
            className="p-1.5 rounded-md border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 active:bg-rose-950/40 transition-colors cursor-pointer"
            title="Delete this monitor target"
          >
            {isDeleting ? (
              <svg className="animate-spin h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
