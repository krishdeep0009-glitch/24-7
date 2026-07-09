export interface HttpHeader {
  key: string;
  value: string;
}

export type MonitorStatus = 'online' | 'offline' | 'paused' | 'pending';

export interface MonitoredSite {
  id: string;
  url: string;
  name: string;
  interval: number; // in milliseconds (e.g. 120000 for 2 minutes)
  isActive: boolean;
  method: 'GET' | 'HEAD' | 'POST';
  headers: HttpHeader[];
  body?: string;
  timeout: number; // in milliseconds (e.g. 10000 for 10s)
  
  // Real-time status fields
  status: MonitorStatus;
  lastChecked?: string; // ISO string
  lastResponseTime?: number; // ms
  lastStatusCode?: number; // HTTP status code
  lastStatusText?: string; // e.g. "OK", "Timeout", "FetchError"
  uptimePercentage: number;
  totalChecks: number;
  successfulChecks: number;
  createdAt: string; // ISO string
}

export interface PingLog {
  id: string;
  siteId: string;
  timestamp: string; // ISO string
  status: 'online' | 'offline';
  responseTime: number; // ms
  statusCode: number | null;
  statusText: string; // HTTP text or error details
  responseSize?: number; // bytes
}

export interface MonitorStats {
  totalSites: number;
  activeSites: number;
  onlineSites: number;
  offlineSites: number;
  avgResponseTime: number; // ms across all successful last checks
  overallUptime: number; // percentage
}
