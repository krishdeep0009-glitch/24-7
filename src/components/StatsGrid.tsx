import { motion } from "motion/react";
import { Activity, Play, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { MonitorStats } from "../types";

interface StatsGridProps {
  stats: MonitorStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.35,
        ease: "easeOut"
      }
    })
  };

  const statItems = [
    {
      label: "Overall Uptime",
      value: `${stats.overallUptime}%`,
      subtext: "Across all monitored websites",
      icon: CheckCircle2,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      valueColor: "text-emerald-400",
      progress: stats.overallUptime
    },
    {
      label: "Average Response",
      value: `${stats.avgResponseTime} ms`,
      subtext: "Latency of online servers",
      icon: Clock,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      valueColor: "text-sky-400",
      progress: null
    },
    {
      label: "Active Targets",
      value: `${stats.activeSites} / ${stats.totalSites}`,
      subtext: "Running 24/7 background loops",
      icon: Play,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      valueColor: "text-blue-400",
      progress: stats.totalSites > 0 ? (stats.activeSites / stats.totalSites) * 100 : 0
    },
    {
      label: "Incidents Active",
      value: `${stats.offlineSites}`,
      subtext: "Websites currently offline",
      icon: AlertTriangle,
      color: stats.offlineSites > 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-slate-400 bg-slate-500/10 border-slate-500/20",
      valueColor: stats.offlineSites > 0 ? "text-rose-400" : "text-slate-300",
      progress: null
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            custom={idx}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="bg-[#0f172a]/50 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
            id={`stat-card-${idx}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.label}</span>
                <span className={`p-2 rounded-lg border ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold font-sans tracking-tight ${item.valueColor}`}>{item.value}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{item.subtext}</p>
            </div>

            {item.progress !== null && (
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-4">
                <div
                  className={`h-full rounded-full ${
                    item.label.includes("Uptime") ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, item.progress))}%` }}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
