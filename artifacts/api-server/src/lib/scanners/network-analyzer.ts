// ─── Network Request Analyzer ─────────────────────────────────────────────────
// Mock implementation. Replace with Playwright HAR capture / WebPageTest API.
// Interface: AuditScanner<NetworkRequests>

import type { AuditScanner, AuditContext, NetworkRequests } from "../audit-types";

export interface NetworkHARAdapter {
  captureHAR(url: string): Promise<{
    entries: Array<{
      url: string;
      method: string;
      statusCode: number;
      durationMs: number;
      sizeBytes: number;
      type: "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other";
      cached: boolean;
      domain: string;
      initiatorDomain: string;
    }>;
  }>;
}

const mockNetworkHARAdapter: NetworkHARAdapter = {
  async captureHAR(url) {
    const rand = Math.random();
    const domain = new URL(url).hostname;

    const entries = [
      { url, method: "GET", statusCode: 200, durationMs: Math.round(150 + rand * 500), sizeBytes: 12400, type: "document" as const, cached: false, domain, initiatorDomain: domain },
      { url: `${url}/assets/main.js`, method: "GET", statusCode: 200, durationMs: Math.round(200 + rand * 800), sizeBytes: Math.round(320000 + rand * 480000), type: "script" as const, cached: rand > 0.5, domain, initiatorDomain: domain },
      { url: `${url}/assets/vendor.js`, method: "GET", statusCode: 200, durationMs: Math.round(300 + rand * 1200), sizeBytes: Math.round(480000 + rand * 720000), type: "script" as const, cached: rand > 0.4, domain, initiatorDomain: domain },
      { url: `${url}/assets/app.css`, method: "GET", statusCode: 200, durationMs: Math.round(80 + rand * 200), sizeBytes: Math.round(45000 + rand * 85000), type: "stylesheet" as const, cached: rand > 0.6, domain, initiatorDomain: domain },
      { url: `${url}/images/hero.webp`, method: "GET", statusCode: 200, durationMs: Math.round(100 + rand * 400), sizeBytes: Math.round(180000 + rand * 620000), type: "image" as const, cached: rand > 0.3, domain, initiatorDomain: domain },
      { url: `${url}/api/user`, method: "GET", statusCode: 200, durationMs: Math.round(80 + rand * 320), sizeBytes: 1240, type: "fetch" as const, cached: false, domain, initiatorDomain: domain },
      { url: "https://www.google-analytics.com/analytics.js", method: "GET", statusCode: 200, durationMs: Math.round(60 + rand * 180), sizeBytes: 48200, type: "script" as const, cached: rand > 0.7, domain: "www.google-analytics.com", initiatorDomain: domain },
      { url: "https://connect.facebook.net/en_US/fbevents.js", method: "GET", statusCode: 200, durationMs: Math.round(120 + rand * 280), sizeBytes: 32800, type: "script" as const, cached: rand > 0.6, domain: "connect.facebook.net", initiatorDomain: domain },
      { url: `https://fonts.googleapis.com/css2?family=Inter`, method: "GET", statusCode: 200, durationMs: Math.round(40 + rand * 100), sizeBytes: 4200, type: "stylesheet" as const, cached: rand > 0.8, domain: "fonts.googleapis.com", initiatorDomain: domain },
      ...(rand > 0.6 ? [{ url: `${url}/api/slow-endpoint`, method: "POST", statusCode: rand > 0.8 ? 500 : 200, durationMs: Math.round(2000 + rand * 3000), sizeBytes: 840, type: "fetch" as const, cached: false, domain, initiatorDomain: domain }] : []),
    ];

    return { entries };
  },
};

class NetworkAnalyzer implements AuditScanner<NetworkRequests> {
  readonly name = "network" as const;
  readonly description = "Analyzes network requests for performance bottlenecks and third-party impact";
  readonly version = "1.0.0";
  readonly adapter = "playwright-har";

  private harAdapter: NetworkHARAdapter;

  constructor(adapter: NetworkHARAdapter = mockNetworkHARAdapter) {
    this.harAdapter = adapter;
  }

  async run(context: AuditContext): Promise<NetworkRequests> {
    const startedAt = new Date();

    try {
      const { entries } = await this.harAdapter.captureHAR(context.url);
      const domain = new URL(context.url).hostname;

      const failed = entries.filter(e => e.statusCode >= 400 || e.statusCode === 0);
      const slow = entries
        .filter(e => e.durationMs > 500)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 10)
        .map(e => ({
          url: e.url,
          method: e.method,
          durationMs: e.durationMs,
          sizeBytes: e.sizeBytes,
          type: e.type,
          cached: e.cached,
          statusCode: e.statusCode,
        }));

      // Group third-party by domain
      const thirdPartyMap = new Map<string, { count: number; size: number }>();
      for (const e of entries) {
        if (!e.domain.includes(domain) && e.domain !== domain) {
          const existing = thirdPartyMap.get(e.domain) ?? { count: 0, size: 0 };
          thirdPartyMap.set(e.domain, { count: existing.count + 1, size: existing.size + e.sizeBytes });
        }
      }

      const thirdPartyRequests: NetworkRequests["thirdPartyRequests"] = Array.from(thirdPartyMap.entries()).map(([d, stats]) => ({
        domain: d,
        requestCount: stats.count,
        totalSizeBytes: stats.size,
        impact: d.includes("analytics") || d.includes("facebook") ? "blocking" : "async",
        category: d.includes("analytics") || d.includes("google-analytics") ? "analytics"
          : d.includes("facebook") || d.includes("doubleclick") ? "advertising"
          : d.includes("fonts") ? "cdn"
          : "other",
      }));

      const totalSize = entries.reduce((acc, e) => acc + e.sizeBytes, 0);
      const totalDuration = entries.reduce((acc, e) => acc + e.durationMs, 0);
      const uncached = entries.filter(e => !e.cached && e.statusCode === 200).length;

      const completedAt = new Date();
      return {
        scannerName: "network",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        summary: {
          totalRequests: entries.length,
          failedRequests: failed.length,
          totalTransferSizeBytes: totalSize,
          totalDurationMs: totalDuration,
          cachingOpportunities: Math.max(0, uncached - 2),
          compressionOpportunities: Math.round(entries.length * 0.15),
        },
        slowRequests: slow,
        thirdPartyRequests,
        failedRequests: failed.map(e => ({
          url: e.url,
          statusCode: e.statusCode,
          errorType: e.statusCode >= 500 ? "server-error" : e.statusCode >= 400 ? "client-error" : "connection-error",
          method: e.method,
        })),
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "network",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Network analysis failed",
        summary: { totalRequests: 0, failedRequests: 0, totalTransferSizeBytes: 0, totalDurationMs: 0, cachingOpportunities: 0, compressionOpportunities: 0 },
        slowRequests: [],
        thirdPartyRequests: [],
        failedRequests: [],
      };
    }
  }
}

export default new NetworkAnalyzer();
export { NetworkAnalyzer };
