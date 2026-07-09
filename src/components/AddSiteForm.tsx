import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Settings, ChevronDown, ChevronUp, AlertCircle, HelpCircle } from "lucide-react";
import { HttpHeader } from "../types";

interface AddSiteFormProps {
  onAdd: (siteData: {
    url: string;
    name: string;
    interval: number;
    method: "GET" | "HEAD" | "POST";
    headers: HttpHeader[];
    timeout: number;
    body?: string;
  }) => Promise<void>;
}

const extractCsbId = (val: string): string | null => {
  if (!val || !val.includes("codesandbox.io")) return null;
  // Match patterns like /p/devbox/7pd2c4 or /p/sandbox/7pd2c4
  const devboxMatch = val.match(/codesandbox\.io\/p\/(?:devbox|sandbox)\/([a-zA-Z0-9\-]+)/i);
  if (devboxMatch) return devboxMatch[1];
  
  // Match patterns like /s/7pd2c4
  const sMatch = val.match(/codesandbox\.io\/s\/([a-zA-Z0-9\-]+)/i);
  if (sMatch) return sMatch[1];

  // Match patterns like /embed/7pd2c4
  const embedMatch = val.match(/codesandbox\.io\/embed\/([a-zA-Z0-9\-]+)/i);
  if (embedMatch) return embedMatch[1];

  // Fallback: any 5+ char alphanumeric at the end of path
  const fallback = val.match(/\/([a-zA-Z0-9\-]{5,})$/);
  if (fallback) return fallback[1];

  return null;
};

const extractGithubCodespaceId = (val: string): { codespaceName: string; port: string | null } | null => {
  if (!val) return null;
  if (!val.includes("github.dev") && !val.includes("github.com")) return null;

  // Match: https://legendary-space-goggles-r477wgppwg7hpx95-3000.app.github.dev
  // Or: http://legendary-space-goggles-r477wgppwg7hpx95-3000.app.github.dev
  const appMatch = val.match(/(?:https?:\/\/)?([a-zA-Z0-9\-]+)-(\d+)\.app\.github\.dev/i);
  if (appMatch) {
    return { codespaceName: appMatch[1], port: appMatch[2] };
  }

  // Match: legendary-space-goggles-r477wgppwg7hpx95.github.dev
  const devMatch = val.match(/(?:https?:\/\/)?([a-zA-Z0-9\-]+)\.github\.dev/i);
  if (devMatch) {
    return { codespaceName: devMatch[1], port: null };
  }

  // Match: github.com/codespaces/legendary-space-goggles-r477wgppwg7hpx95
  const codespaceDashboardMatch = val.match(/github\.com\/codespaces\/([a-zA-Z0-9\-]+)/i);
  if (codespaceDashboardMatch) {
    return { codespaceName: codespaceDashboardMatch[1], port: null };
  }

  return null;
};

export default function AddSiteForm({ onAdd }: AddSiteFormProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [interval, setIntervalVal] = useState(120000); // Default 2 minutes (120000ms)
  const [method, setMethod] = useState<"GET" | "HEAD" | "POST">("GET");
  const [timeout, setTimeoutVal] = useState(10); // Default 10s
  const [headers, setHeaders] = useState<HttpHeader[]>([]);
  const [body, setBody] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");

  const intervalPresets = [
    { label: "1 min", value: 60000 },
    { label: "2 min", value: 120000, recommended: true },
    { label: "5 min", value: 300000 },
    { label: "10 min", value: 600000 },
    { label: "30 min", value: 1800000 },
  ];

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleRemoveHeader = (idx: number) => {
    setHeaders(headers.filter((_, i) => i !== idx));
  };

  const handleHeaderChange = (idx: number, field: "key" | "value", value: string) => {
    const updated = [...headers];
    updated[idx][field] = value;
    setHeaders(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please specify a target website URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Basic URL verification/completion
      let targetUrl = url.trim();
      
      // Automatic CodeSandbox editor-to-live-app converter
      const csbId = extractCsbId(targetUrl);
      if (csbId) {
        targetUrl = `https://${csbId}.csb.app`;
      }

      // Automatic GitHub Codespaces editor-to-live-app converter
      const ghCodespace = extractGithubCodespaceId(targetUrl);
      if (ghCodespace) {
        const port = ghCodespace.port || "3000";
        targetUrl = `https://${ghCodespace.codespaceName}-${port}.app.github.dev`;
      }

      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      // Filter out empty headers
      const validHeaders = headers.filter(h => h.key.trim() !== "");

      await onAdd({
        url: targetUrl,
        name: name.trim() || (csbId ? `CodeSandbox ${csbId}` : (ghCodespace ? `GitHub Codespace ${ghCodespace.codespaceName}` : targetUrl)),
        interval,
        method,
        headers: validHeaders,
        timeout: timeout * 1000, // convert s to ms
        body: method === "POST" ? body : undefined
      });

      // Reset state
      setUrl("");
      setName("");
      setIntervalVal(120000);
      setMethod("GET");
      setHeaders([]);
      setBody("");
      setTimeoutVal(10);
      setShowAdvanced(false);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while adding the site.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedCsbId = extractCsbId(url);
  const detectedGhCodespace = extractGithubCodespaceId(url);

  return (
    <div className="bg-[#0f172a]/50 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl mb-6" id="add-site-form-container">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-2">
        <div className="flex-1 min-w-[280px]">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-500 animate-pulse" />
            Monitor a New Website
          </h2>
          <p className="text-xs text-slate-400">
            Set up 24/7 background keep-alive pings and uptime status logs. Operates continuously even if you close this page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setUrl("https://YOUR-SANDBOX-ID.csb.app");
              setName("My CodeSandbox Project");
              setIntervalVal(120000); // 2 minutes
              setHeaders([
                { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
              ]);
              setError("");
            }}
            className="text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Pre-fill values to wake CodeSandbox every 2 minutes"
          >
            ⚡ CodeSandbox Preset
          </button>
          <button
            type="button"
            onClick={() => {
              setUrl("https://YOUR-CODESPACE-ID-3000.app.github.dev");
              setName("My GitHub Codespace");
              setIntervalVal(120000); // 2 minutes
              setHeaders([
                { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
              ]);
              setError("");
            }}
            className="text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Pre-fill values to wake GitHub Codespaces every 2 minutes"
          >
            🐙 Codespaces Preset
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="url-input" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Website or API URL <span className="text-rose-500">*</span>
            </label>
            <input
              id="url-input"
              type="text"
              required
              placeholder="https://yourwebsite.com or api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full text-sm rounded-lg bg-[#020617] border border-slate-800 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
            />

            {detectedCsbId && (
              <div className="mt-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">⚡</span>
                  <span className="font-bold">CodeSandbox Project Link Detected</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  You pasted a CodeSandbox editor URL. To run your project 24/7, we must ping your sandbox's <strong>live app container URL</strong>. Choose one of the following to convert:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedCsbId}-3000.csb.app`);
                      if (!name) setName(`CodeSandbox ${detectedCsbId} (Port 3000)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-blue-500/10 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🌐 Convert to Port 3000: <code className="text-white">https://{detectedCsbId}-3000.csb.app</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedCsbId}-3000.preview.csb.app`);
                      if (!name) setName(`CodeSandbox ${detectedCsbId} (Port 3000 Preview)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🚀 Convert to Port 3000 Preview: <code className="text-white">https://{detectedCsbId}-3000.preview.csb.app</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedCsbId}.csb.app`);
                      if (!name) setName(`CodeSandbox ${detectedCsbId}`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🌱 Convert to Standard App: <code className="text-white">https://{detectedCsbId}.csb.app</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedCsbId}.preview.csb.app`);
                      if (!name) setName(`CodeSandbox ${detectedCsbId} (Preview)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    ✨ Convert to Standard Preview: <code className="text-white">https://{detectedCsbId}.preview.csb.app</code>
                  </button>
                </div>

                {/* CRITICAL CODESANDBOX INSTRUCTION GUIDE */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-200 font-bold mb-2">
                    <span>🔓</span>
                    <span>REQUIRED: Make your Port "Public" on CodeSandbox</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-2.5">
                    CodeSandbox Devboxes are private by default. If your project is private, our background server's pings are blocked by CodeSandbox's login page, causing your app to go to sleep.
                  </p>
                  <div className="bg-slate-950/60 rounded-lg p-2.5 space-y-2 border border-slate-900/80">
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-amber-400 font-bold shrink-0">Step 1:</span>
                      <span className="text-slate-300">
                        In your CodeSandbox browser tab, look at the bottom-right panel named <strong>Ports</strong> or <strong>Previews</strong>.
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-amber-400 font-bold shrink-0">Step 2:</span>
                      <span className="text-slate-300">
                        Find your active port (e.g., <code className="bg-slate-900 text-white px-1 rounded">3000</code>). Click the <strong className="text-rose-400">🔒 Private</strong> badge next to it.
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-amber-400 font-bold shrink-0">Step 3:</span>
                      <span className="text-slate-300">
                        Select <strong className="text-emerald-400">🔓 Public</strong>. This allows our ping server to keep it active 24/7!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detectedGhCodespace && (
              <div className="mt-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">🐙</span>
                  <span className="font-bold">GitHub Codespace Link Detected</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  You pasted a GitHub Codespace editor URL. To run your project 24/7, we must ping your active <strong>forwarded port URL</strong>. Choose one of the following ports to convert:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedGhCodespace.codespaceName}-3000.app.github.dev`);
                      if (!name) setName(`Codespace ${detectedGhCodespace.codespaceName} (Port 3000)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-blue-500/10 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🌐 Convert to Port 3000: <code className="text-white">https://{detectedGhCodespace.codespaceName}-3000.app.github.dev</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedGhCodespace.codespaceName}-5173.app.github.dev`);
                      if (!name) setName(`Codespace ${detectedGhCodespace.codespaceName} (Port 5173)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🚀 Convert to Port 5173 (Vite): <code className="text-white">https://{detectedGhCodespace.codespaceName}-5173.app.github.dev</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedGhCodespace.codespaceName}-8000.app.github.dev`);
                      if (!name) setName(`Codespace ${detectedGhCodespace.codespaceName} (Port 8000)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    🌱 Convert to Port 8000: <code className="text-white">https://{detectedGhCodespace.codespaceName}-8000.app.github.dev</code>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUrl(`https://${detectedGhCodespace.codespaceName}-8080.app.github.dev`);
                      if (!name) setName(`Codespace ${detectedGhCodespace.codespaceName} (Port 8080)`);
                      if (headers.length === 0) {
                        setHeaders([
                          { key: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                          { key: "Accept", value: "text/html,application/xhtml+xml,application/xml" }
                        ]);
                      }
                    }}
                    className="w-full text-left bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] cursor-pointer truncate"
                  >
                    ✨ Convert to Port 8080: <code className="text-white">https://{detectedGhCodespace.codespaceName}-8080.app.github.dev</code>
                  </button>
                </div>

                {/* CRITICAL CODESPACES INSTRUCTION GUIDE */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-bold mb-2">
                    <span>🔓</span>
                    <span>REQUIRED: Make your Port "Public" on GitHub Codespaces</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-2.5">
                    GitHub Codespaces ports are private by default. If your port is private, our background server's pings are blocked by GitHub's login page, causing your workspace to suspend.
                  </p>
                  <div className="bg-slate-950/60 rounded-lg p-2.5 space-y-2 border border-slate-900/80">
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-indigo-400 font-bold shrink-0">Step 1:</span>
                      <span className="text-slate-300">
                        In your active Codespace tab, open the bottom panel and choose the <strong>Ports</strong> tab (next to Terminal).
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-indigo-400 font-bold shrink-0">Step 2:</span>
                      <span className="text-slate-300">
                        Right-click your active port (e.g., <code className="bg-slate-900 text-white px-1 rounded">3000</code>) or hover over its "Port Visibility" column.
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="text-indigo-400 font-bold shrink-0">Step 3:</span>
                      <span className="text-slate-300">
                        Change the visibility from <strong className="text-rose-400 font-bold">🔒 Private</strong> to <strong className="text-emerald-400 font-bold">🔓 Public</strong>. This lets our 24/7 keeper ping and run it indefinitely!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="name-input" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Friendly Display Name <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="name-input"
              type="text"
              placeholder="e.g. My Portfolio Site"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg bg-[#020617] border border-slate-800 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Interval Selector */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Ping Interval
          </span>
          <div className="flex flex-wrap gap-2">
            {intervalPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setIntervalVal(preset.value)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  interval === preset.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                    : "bg-slate-900/80 text-slate-300 border-slate-850 hover:bg-slate-800"
                }`}
              >
                {preset.label}
                {preset.recommended && (
                  <span className={`ml-1 text-[9px] px-1 rounded ${interval === preset.value ? "bg-blue-700 text-blue-100" : "bg-blue-950 text-blue-400"}`}>
                    Rec
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            Interval rate at which our secure cloud server will run keep-awake request pings.
          </p>
        </div>

        {/* Advanced Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-semibold cursor-pointer py-1"
        >
          <Settings className="h-3.5 w-3.5" />
          {showAdvanced ? "Hide advanced HTTP parameters" : "Show advanced HTTP parameters"}
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Advanced Section */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden border-t border-slate-800 pt-4 mt-2 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="method-select" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    HTTP Request Method
                  </label>
                  <select
                    id="method-select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full text-sm rounded-lg bg-[#020617] border border-slate-800 px-3.5 py-2.5 text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  >
                    <option value="GET">GET (Request webpage body & headers)</option>
                    <option value="HEAD">HEAD (Fast header-only request, low latency)</option>
                    <option value="POST">POST (Send body payload/JSON to API)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="timeout-input" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Connection Timeout (seconds)
                  </label>
                  <input
                    id="timeout-input"
                    type="number"
                    min="1"
                    max="60"
                    placeholder="10"
                    value={timeout}
                    onChange={(e) => setTimeoutVal(parseInt(e.target.value) || 10)}
                    className="w-full text-sm rounded-lg bg-[#020617] border border-slate-800 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
              </div>

              {method === "POST" && (
                <div>
                  <label htmlFor="body-input" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    POST Body Payload
                  </label>
                  <textarea
                    id="body-input"
                    rows={3}
                    placeholder='e.g. { "action": "reset", "source": "247monitor" }'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full text-sm rounded-lg bg-[#020617] border border-slate-800 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
              )}

              {/* Custom HTTP Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Custom HTTP Headers</span>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    + Add header rule
                  </button>
                </div>

                {headers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No custom headers configured. (Default: system agent header only)</p>
                ) : (
                  <div className="space-y-2">
                    {headers.map((header, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Header Name (e.g. Authorization)"
                          value={header.key}
                          onChange={(e) => handleHeaderChange(idx, "key", e.target.value)}
                          className="flex-1 text-xs rounded-lg bg-[#020617] border border-slate-800 px-3 py-1.5 text-slate-100 focus:border-blue-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Header Value (e.g. Bearer token...)"
                          value={header.value}
                          onChange={(e) => handleHeaderChange(idx, "value", e.target.value)}
                          className="flex-1 text-xs rounded-lg bg-[#020617] border border-slate-800 px-3 py-1.5 text-slate-100 focus:border-blue-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-semibold cursor-pointer px-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-all cursor-pointer flex items-center gap-1.5 ${
              isSubmitting ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Configuring target...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Start 24/7 Monitoring
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
