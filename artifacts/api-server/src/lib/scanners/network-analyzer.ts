// ─── Network Analyzer ─────────────────────────────────────────────────────────
// Uses Playwright to capture every network request during page load.
// Reports: timings, sizes, failures, third-party origins, slowest requests,
// largest requests by category (images, JS, CSS), per-type breakdown,
// cache-header analysis, and compression opportunities.

import type { AuditScanner, AuditContext, NetworkRequests } from "../audit-types";
import { withPage } from "./playwright-browser";

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
      cacheControl?: string;
      contentEncoding?: string;
      contentType?: string;
    }>;
  }>;
}

// ─── Real adapter: Playwright network interception ────────────────────────────

const realNetworkAdapter: NetworkHARAdapter = {
  async analyze(url, options = {}) {
    return withPage(async (page) => {
      const entries: Array<{
        url: string; method: string; statusCode: number;
        resourceType: string; sizeBytes: number; durationMs: number;
        cached: boolean; isThirdParty: boolean;
        cacheControl?: string; contentEncoding?: string; contentType?: string;
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
        const respHeaders = res.headers();

        // Size: prefer Content-Length, then read body for small responses
        let sizeBytes = 0;
        const contentLength = respHeaders["content-length"];
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

        const cacheControl   = respHeaders["cache-control"]    ?? "";
        const contentEncoding = respHeaders["content-encoding"] ?? "";
        const contentType     = respHeaders["content-type"]     ?? "";

        const cached =
          res.status() === 304 ||
          (cacheControl.includes("max-age") && !cacheControl.includes("no-cache")) ||
          ((respHeaders["x-cache"] ?? "").toUpperCase().includes("HIT")) ||
          cacheControl.includes("immutable");

        entries.push({
          url: reqUrl,
          method: res.request().method(),
          statusCode: res.status(),
          resourceType: res.request().resourceType(),
          sizeBytes,
          durationMs,
          cached,
          isThirdParty: !reqUrl.startsWith(origin),
          cacheControl: cacheControl || undefined,
          contentEncoding: contentEncoding || undefined,
          contentType: contentType || undefined,
        });
      });

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: options.timeout ?? 25000 });
      } catch {
        // Partial capture on timeout
      }

      await page.waitForTimeout(500);
      return { entries };
    }, { timeoutMs: 35000 });
  },
};

// ─── Resource-type normaliser ─────────────────────────────────────────────────

function toSlowType(
  rt: string,
): "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other" {
  const map: Record<string, "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other"> = {
    document: "document", script: "script", stylesheet: "stylesheet",
    image: "image", font: "font", xhr: "xhr", fetch: "fetch",
  };
  return map[rt] ?? "other";
}

class NetworkAnalyzer implements AuditScanner<NetworkRequests> {
  readonly name = "network" as const;
  readonly description =
    "Playwright network capture: request timings, sizes, failures, largest resources by type, cache & compression analysis";
  readonly version = "3.0.0";
  readonly adapter = "playwright-network";

  private networkAdapter: NetworkHARAdapter;

  constructor(adapter: NetworkHARAdapter = realNetworkAdapter) {
    this.networkAdapter = adapter;
  }

  async run(context: AuditContext): Promise<NetworkRequests> {
    const startedAt = new Date();

    try {
      const { entries } = await this.networkAdapter.analyze(context.url, { timeout: 25000 });

      const failed = entries.filter(e => e.statusCode >= 400 || e.statusCode === 0);

      // Slowest requests (excluding failures)
      const slow = entries
        .filter(e => e.durationMs > 1000 && e.statusCode < 400)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 10);

      // Largest requests by size (excluding cached, excluding failures)
      const largest = entries
        .filter(e => e.sizeBytes > 0 && e.statusCode < 400)
        .sort((a, b) => b.sizeBytes - a.sizeBytes)
        .slice(0, 15);

      // Per resource-type breakdown
      const byResourceType: Record<string, { count: number; totalBytes: number; cachedCount: number; avgDurationMs: number }> = {};
      for (const e of entries) {
        const rt = toSlowType(e.resourceType);
        if (!byResourceType[rt]) {
          byResourceType[rt] = { count: 0, totalBytes: 0, cachedCount: 0, avgDurationMs: 0 };
        }
        const bucket = byResourceType[rt];
        bucket.count++;
        bucket.totalBytes += e.sizeBytes;
        if (e.cached) bucket.cachedCount++;
        bucket.avgDurationMs = Math.round(
          (bucket.avgDurationMs * (bucket.count - 1) + e.durationMs) / bucket.count,
        );
      }

      // Third-party origins
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
        impact: "deferred" as const,
        category: "other" as const,
      }));

      // Aggregates
      const totalSize     = entries.reduce((s, e) => s + e.sizeBytes, 0);
      const totalDuration = entries.reduce((s, e) => s + e.durationMs, 0);
      const uncached = entries.filter(e => !e.cached && e.statusCode === 200).length;

      const compressionOpportunities = entries.filter(
        e => !e.cached &&
          e.sizeBytes > 1024 &&
          !e.contentEncoding &&
          ["document", "script", "stylesheet", "fetch", "xhr"].includes(e.resourceType),
      ).length;

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
          compressionOpportunities,
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
        // largestRequests is an extension field stored in JSONB
        ...(largest.length > 0 && {
          largestRequests: largest.map(e => ({
            url: e.url,
            method: e.method,
            sizeBytes: e.sizeBytes,
            durationMs: e.durationMs,
            type: toSlowType(e.resourceType),
            cached: e.cached,
            statusCode: e.statusCode,
          })),
        }),
        ...(Object.keys(byResourceType).length > 0 && { byResourceType }),
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
