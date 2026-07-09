import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { MonitoredSite, PingLog } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const SITES_FILE = path.join(process.cwd(), "monitored_sites.json");
  const HISTORY_FILE = path.join(process.cwd(), "monitored_history.json");

  // Helper to load sites
  function loadSites(): MonitoredSite[] {
    try {
      if (fs.existsSync(SITES_FILE)) {
        const data = fs.readFileSync(SITES_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading sites, resetting:", error);
    }
    return [];
  }

  // Helper to save sites
  function saveSites(sites: MonitoredSite[]) {
    try {
      fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2), "utf-8");
    } catch (error) {
      console.error("Error saving sites:", error);
    }
  }

  // Helper to load history
  function loadHistory(): PingLog[] {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    }
    return [];
  }

  // Helper to save history and prune old records (keep last 100 per site)
  function saveHistory(history: PingLog[]) {
    try {
      const grouped = new Map<string, PingLog[]>();
      for (const log of history) {
        if (!grouped.has(log.siteId)) {
          grouped.set(log.siteId, []);
        }
        grouped.get(log.siteId)!.push(log);
      }
      
      const pruned: PingLog[] = [];
      for (const [_, logs] of grouped) {
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        pruned.push(...logs.slice(0, 100));
      }

      fs.writeFileSync(HISTORY_FILE, JSON.stringify(pruned, null, 2), "utf-8");
    } catch (error) {
      console.error("Error saving history:", error);
    }
  }

  // Uptime/Ping implementation
  async function pingSite(siteId: string): Promise<PingLog | null> {
    const sites = loadSites();
    const site = sites.find(s => s.id === siteId);
    if (!site) return null;

    console.log(`[Monitor 24/7] Pinging "${site.name}" (${site.url}) at ${new Date().toISOString()}`);

    const startTime = Date.now();
    let status: 'online' | 'offline' = 'offline';
    let statusCode: number | null = null;
    let statusText = '';
    let responseSize = 0;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), site.timeout || 10000);

    try {
      const headersObj: Record<string, string> = {};
      site.headers.forEach(h => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      const options: RequestInit = {
        method: site.method || 'GET',
        headers: headersObj,
        signal: controller.signal,
      };

      if (site.method === 'POST' && site.body) {
        options.body = site.body;
      }

      const response = await fetch(site.url, options);
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      statusCode = response.status;
      statusText = response.statusText || `HTTP ${response.status}`;

      try {
        const text = await response.text();
        responseSize = text.length;
      } catch {
        responseSize = 0;
      }

      // For 24/7 keep-alive purposes, any response from the server (even 4xx/5xx error codes)
      // indicates that the server is alive, active, and successfully reached.
      status = (response.status >= 200 && response.status < 600) ? 'online' : 'offline';

      const log: PingLog = {
        id: Math.random().toString(36).substring(2, 11),
        siteId,
        timestamp: new Date().toISOString(),
        status,
        responseTime,
        statusCode,
        statusText,
        responseSize,
      };

      // Update statistics
      const updatedSites = loadSites();
      const s = updatedSites.find(item => item.id === siteId);
      if (s) {
        s.status = status;
        s.lastChecked = log.timestamp;
        s.lastResponseTime = responseTime;
        s.lastStatusCode = statusCode;
        s.lastStatusText = statusText;
        s.totalChecks += 1;
        if (status === 'online') {
          s.successfulChecks += 1;
        }
        s.uptimePercentage = parseFloat(((s.successfulChecks / s.totalChecks) * 100).toFixed(2));
        saveSites(updatedSites);
      }

      const history = loadHistory();
      history.push(log);
      saveHistory(history);

      return log;

    } catch (error: any) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      let errMessage = 'Connection refused / Unreachable';

      if (error.name === 'AbortError') {
        errMessage = 'Connection Timeout (Exceeded limit)';
      } else if (error.message) {
        errMessage = error.message;
      }

      statusText = errMessage;

      const log: PingLog = {
        id: Math.random().toString(36).substring(2, 11),
        siteId,
        timestamp: new Date().toISOString(),
        status: 'offline',
        responseTime,
        statusCode: null,
        statusText: errMessage,
        responseSize: 0,
      };

      const updatedSites = loadSites();
      const s = updatedSites.find(item => item.id === siteId);
      if (s) {
        s.status = 'offline';
        s.lastChecked = log.timestamp;
        s.lastResponseTime = responseTime;
        s.lastStatusCode = null;
        s.lastStatusText = errMessage;
        s.totalChecks += 1;
        s.uptimePercentage = parseFloat(((s.successfulChecks / s.totalChecks) * 100).toFixed(2));
        saveSites(updatedSites);
      }

      const history = loadHistory();
      history.push(log);
      saveHistory(history);

      return log;
    }
  }

  // Active timers tracking
  const activeTimers = new Map<string, NodeJS.Timeout>();

  function startScheduler(site: MonitoredSite) {
    stopScheduler(site.id);
    if (!site.isActive) return;

    console.log(`[Monitor 24/7 Scheduler] Started timer for "${site.name}" every ${site.interval / 1000}s`);
    
    const timer = setInterval(() => {
      pingSite(site.id).catch(err => console.error(`Failed background ping for ${site.id}:`, err));
    }, site.interval);

    activeTimers.set(site.id, timer);
  }

  function stopScheduler(siteId: string) {
    if (activeTimers.has(siteId)) {
      console.log(`[Monitor 24/7 Scheduler] Cleared timer for site ID: ${siteId}`);
      clearInterval(activeTimers.get(siteId)!);
      activeTimers.delete(siteId);
    }
  }

  function initializeSchedulers() {
    const sites = loadSites();
    
    // Add default self-monitoring app URL as demo if empty
    if (sites.length === 0) {
      const selfUrl = process.env.APP_URL || "https://httpbin.org/get";
      const defaultSite: MonitoredSite = {
        id: "demo-self",
        name: "Self Keep-Alive / Monitor",
        url: selfUrl,
        interval: 120000, // 2 minutes
        isActive: true,
        method: "GET",
        headers: [
          { key: "User-Agent", value: "UptimeMonitor24-7/1.0" }
        ],
        timeout: 10000,
        status: "pending",
        uptimePercentage: 100,
        totalChecks: 0,
        successfulChecks: 0,
        createdAt: new Date().toISOString()
      };
      sites.push(defaultSite);
      saveSites(sites);
    }

    sites.forEach(site => {
      if (site.isActive) {
        startScheduler(site);
        // Fire initial ping immediately so frontend doesn't show "pending" indefinitely
        pingSite(site.id).catch(err => console.error("Initial boot ping failed:", err));
      }
    });
  }

  // API Routes
  app.get("/api/sites", (req, res) => {
    res.json(loadSites());
  });

  app.post("/api/sites", (req, res) => {
    const { url, name, interval, method, headers, timeout, body } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "Website URL is required" });
    }

    let cleanedUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanedUrl)) {
      cleanedUrl = "https://" + cleanedUrl;
    }

    const sites = loadSites();
    const newSite: MonitoredSite = {
      id: Math.random().toString(36).substring(2, 11),
      url: cleanedUrl,
      name: (name || url).trim(),
      interval: parseInt(interval) || 120000,
      isActive: true,
      method: method || "GET",
      headers: headers || [],
      body: body || "",
      timeout: parseInt(timeout) || 10000,
      status: "pending",
      uptimePercentage: 100,
      totalChecks: 0,
      successfulChecks: 0,
      createdAt: new Date().toISOString()
    };

    sites.push(newSite);
    saveSites(sites);
    startScheduler(newSite);

    // Initial ping
    pingSite(newSite.id).catch(err => console.error("Immediate ping failed:", err));

    res.status(201).json(newSite);
  });

  app.delete("/api/sites/:id", (req, res) => {
    const { id } = req.params;
    stopScheduler(id);

    let sites = loadSites();
    sites = sites.filter(s => s.id !== id);
    saveSites(sites);

    let history = loadHistory();
    history = history.filter(h => h.siteId !== id);
    saveHistory(history);

    res.json({ success: true });
  });

  app.post("/api/sites/:id/toggle", (req, res) => {
    const { id } = req.params;
    const sites = loadSites();
    const site = sites.find(s => s.id === id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    site.isActive = !site.isActive;
    if (!site.isActive) {
      site.status = "paused";
      stopScheduler(id);
    } else {
      site.status = "pending";
      startScheduler(site);
      pingSite(id).catch(err => console.error("Toggled active ping failed:", err));
    }

    saveSites(sites);
    res.json(site);
  });

  app.post("/api/sites/:id/ping", async (req, res) => {
    const { id } = req.params;
    const log = await pingSite(id);
    if (!log) {
      return res.status(404).json({ error: "Site not found" });
    }
    const sites = loadSites();
    const updatedSite = sites.find(s => s.id === id);
    res.json({ site: updatedSite, log });
  });

  app.get("/api/sites/:id/history", (req, res) => {
    const { id } = req.params;
    const history = loadHistory();
    const siteHistory = history
      .filter(h => h.siteId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(siteHistory);
  });

  app.get("/api/stats", (req, res) => {
    const sites = loadSites();
    const totalSites = sites.length;
    const activeSites = sites.filter(s => s.isActive).length;
    const onlineSites = sites.filter(s => s.status === "online").length;
    const offlineSites = sites.filter(s => s.status === "offline").length;

    const successfulResponseTimes = sites
      .filter(s => s.status === "online" && s.lastResponseTime !== undefined)
      .map(s => s.lastResponseTime!);
    
    const avgResponseTime = successfulResponseTimes.length > 0
      ? Math.round(successfulResponseTimes.reduce((a, b) => a + b, 0) / successfulResponseTimes.length)
      : 0;

    const activeUptimePercentages = sites
      .filter(s => s.totalChecks > 0)
      .map(s => s.uptimePercentage);
    
    const overallUptime = activeUptimePercentages.length > 0
      ? parseFloat((activeUptimePercentages.reduce((a, b) => a + b, 0) / activeUptimePercentages.length).toFixed(2))
      : 100;

    res.json({
      totalSites,
      activeSites,
      onlineSites,
      offlineSites,
      avgResponseTime,
      overallUptime
    });
  });

  // Serve static assets in production, otherwise Vite handles development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Start ping background workers
    initializeSchedulers();
  });
}

startServer().catch(err => {
  console.error("Critical server bootstrap failure:", err);
});
