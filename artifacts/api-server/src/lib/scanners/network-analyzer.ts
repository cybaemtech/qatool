// ─── Network Analyzer ─────────────────────────────────────────────────────────
// Real implementation using Playwright to capture all network requests during
// page load: timings, sizes, status codes, third-party origins, slow requests.

import type { AuditScanner, AuditContext, NetworkRequests } from "../audit-types";
import { withPage } from "./playwright-browser";

// Kept as NetworkHARAdapter to match the existing index.ts re-export
export interface NetworkHARAdapter {
  analyze(url: string, options?: { timeout?: number }): Promise<{
    entries: Array<{
      url: string;
      method: string;
      statusCode: number;
      resourceType: string;
      sizeBytes: number;
      durationMs: number;
      cached: boolean;
      isThirdParty: boolean;
    }>;
  }>;
}

// ─── Real adapter: Playwright network interception ────────────────────────────

const realNetworkAdapter: NetworkHARAdapter = {
  async analyze(url, options = {}) {
    return withPage(async (page) => {
      const entries: Array<{
        url: string;
        method: string;
        statusCode: number;
        resourceType: string;
        sizeBytes: number;
        durationMs: number;
        cached: boolean;
        isThirdParty: boolean;
      }> = [];

      const origin = new URL(url).origin;
      const timings = new Map<string, number>();

      page.on("request", (req) => {
        timings.set(req.url(), Date.now());
      });

      page.on("response", async (res) => {
        const reqUrl = res.url();
        const startTime = timings.get(reqUrl) ?? Date.now();
        const durationMs = Date.now() - startTime;

        let sizeBytes = 0;
        const contentLength = res.headers()["content-length"];
        if (contentLength) {
          sizeBytes = parseInt(contentLength, 10) || 0;
        } else if (res.status() < 300 && res.status() !== 204) {
          try {
            const body = await res.body();
            sizeBytes = body.length;
          } catch {
            sizeBytes = 0;
          }
        }

        const cacheControl = res.headers()["cache-control"] ?? "";
        const cached =
          res.status() === 304 ||
          (cacheControl.includes("max-age") && !cacheControl.includes("no-cache")) ||
          (res.headers()["x-cache"] ?? "").toUpperCase().includes("HIT");

        entries.push({
          url: reqUrl,
          method: res.request().method(),
          statusCode: res.status(),
          resourceType: res.request().resourceType(),
          sizeBytes,
          durationMs,
          cached,
          isThirdParty: !reqUrl.startsWith(origin),
        });
      });

      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: options.timeout ?? 25000,
        });
      } catch {
        // Timeout: return what was captured
      }

      await page.waitForTimeout(500);
      return { entries };
    }, { timeoutMs: 35000 });
  },
};

// Map Playwright resourceType to the NetworkRequests slowRequests.type enum
function toSlowType(
  rt: string,
): "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other" {
  const map: Record<string, "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other"> = {
    document: "document",
    script: "script",
    stylesheet: "stylesheet",
    image: "image",
    font: "font",
    xhr: "xhr",
    fetch: "fetch",
  };
  return map[rt] ?? "other";
}

class NetworkAnalyzer implements AuditScanner<NetworkRequests> {
  readonly name = "network" as const;
  readonly description = "Captures all network requests during page load via Playwright: timings, sizes, failures";
  readonly version = "2.0.0";
  readonly adapter = "playwright-network";

  private networkAdapter: NetworkHARAdapter;

  constructor(adapter: NetworkHARAdapter = realNetworkAdapter) {
    this.networkAdapter = adapter;
  }

  async run(context: AuditContext): Promise<NetworkRequests> {
    const startedAt = new Date();

    try {
      const { entries } = await this.networkAdapter.analyze(context.url, {
        timeout: 25000,
      });

      const failed = entries.filter(e => e.statusCode >= 400 || e.statusCode === 0);
      const slow   = entries
        .filter(e => e.durationMs > 1000 && e.statusCode < 400)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 10);

      // Group third-party requests by domain
      const thirdPartyDomains = new Map<string, typeof entries>();
      for (const e of entries.filter(e => e.isThirdParty)) {
        try {
          const d = new URL(e.url).hostname;
          if (!thirdPartyDomains.has(d)) thirdPartyDomains.set(d, []);
          thirdPartyDomains.get(d)!.push(e);
        } catch { /* skip */ }
      }

      const thirdPartyRequests: NetworkRequests["thirdPartyRequests"] = Array.from(
        thirdPartyDomains.entries(),
      ).map(([domain, reqs]) => ({
        domain,
        requestCount: reqs.length,
        totalSizeBytes: reqs.reduce((s, r) => s + r.sizeBytes, 0),
        impact: "deferred" as const,   // conservative; can't determine blocking vs async without timing waterfall
        category: "other" as const,
      }));

      const totalSize    = entries.reduce((s, e) => s + e.sizeBytes, 0);
      const totalDuration = entries.reduce((s, e) => s + e.durationMs, 0);
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
          compressionOpportunities: entries.filter(
            e => !e.cached &&
              e.sizeBytes > 1024 &&
              ["document", "script", "stylesheet", "fetch", "xhr"].includes(e.resourceType),
          ).length,
        },
        slowRequests: slow.map(e => ({
          url: e.url,
          method: e.method,
          durationMs: e.durationMs,
          sizeBytes: e.sizeBytes,
          type: toSlowType(e.resourceType),
          cached: e.cached,
          statusCode: e.statusCode,
        })),
        thirdPartyRequests,
        failedRequests: failed.map(e => ({
          url: e.url,
          statusCode: e.statusCode,
          errorType:
            e.statusCode >= 500 ? "server-error" :
            e.statusCode >= 400 ? "client-error" :
            "connection-error",
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
        summary: {
          totalRequests: 0,
          failedRequests: 0,
          totalTransferSizeBytes: 0,
          totalDurationMs: 0,
          cachingOpportunities: 0,
          compressionOpportunities: 0,
        },
        slowRequests: [],
        thirdPartyRequests: [],
        failedRequests: [],
      };
    }
  }
}

export default new NetworkAnalyzer();
export { NetworkAnalyzer };
