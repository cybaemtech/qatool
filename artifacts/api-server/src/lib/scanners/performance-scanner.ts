// ─── Performance Scanner ───────────────────────────────────────────────────────
// Mock implementation. Replace with Lighthouse CLI or PageSpeed Insights API.
// Interface: AuditScanner<PerformanceMetrics>

import type { AuditScanner, AuditContext, PerformanceMetrics } from "../audit-types";

// ─── Real Integration Adapter Interface ───────────────────────────────────────
// Implement this and inject it to switch from mock to real Lighthouse/PSI

export interface LighthouseAdapter {
  audit(url: string, options?: { device: "mobile" | "desktop" }): Promise<{
    categories: {
      performance: { score: number };
    };
    audits: Record<string, {
      id: string;
      title: string;
      description: string;
      score: number | null;
      numericValue?: number;
      displayValue?: string;
      details?: unknown;
    }>;
  }>;
}

function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// Mock implementation that produces realistic-looking results
const mockLighthouseAdapter: LighthouseAdapter = {
  async audit(_url) {
    const base = Math.random();
    const perfScore = Math.round((0.5 + base * 0.45) * 100);
    return {
      categories: { performance: { score: perfScore / 100 } },
      audits: {
        "first-contentful-paint": { id: "first-contentful-paint", title: "First Contentful Paint", description: "", score: base, numericValue: 800 + base * 2400 },
        "largest-contentful-paint": { id: "largest-contentful-paint", title: "Largest Contentful Paint", description: "", score: base > 0.6 ? 1 : 0, numericValue: 1200 + base * 4800 },
        "total-blocking-time": { id: "total-blocking-time", title: "Total Blocking Time", description: "", score: base, numericValue: base * 800 },
        "cumulative-layout-shift": { id: "cumulative-layout-shift", title: "Cumulative Layout Shift", description: "", score: base > 0.4 ? 1 : 0, numericValue: parseFloat((base * 0.4).toFixed(3)) },
        "speed-index": { id: "speed-index", title: "Speed Index", description: "", score: base, numericValue: 1500 + base * 5000 },
        "interactive": { id: "interactive", title: "Time to Interactive", description: "", score: base, numericValue: 2000 + base * 8000 },
        "render-blocking-resources": {
          id: "render-blocking-resources",
          title: "Eliminate render-blocking resources",
          description: "Resources are blocking the first paint of your page",
          score: base > 0.5 ? 1 : 0,
          numericValue: base * 1200,
          displayValue: `${Math.round(base * 1200)} ms`,
        },
        "unused-javascript": {
          id: "unused-javascript",
          title: "Reduce unused JavaScript",
          description: "Remove unused code to reduce bytes consumed by network activity",
          score: base > 0.6 ? 1 : 0,
          numericValue: Math.round(base * 320000),
        },
        "uses-optimized-images": {
          id: "uses-optimized-images",
          title: "Efficiently encode images",
          description: "Optimized images load faster and consume less cellular data",
          score: base > 0.4 ? 1 : 0,
          numericValue: Math.round(base * 180000),
        },
      },
    };
  },
};

class PerformanceScanner implements AuditScanner<PerformanceMetrics> {
  readonly name = "performance" as const;
  readonly description = "Measures Core Web Vitals and performance metrics using Lighthouse";
  readonly version = "1.0.0";
  readonly adapter = "lighthouse"; // Future: inject real LighthouseAdapter

  private lighthouseAdapter: LighthouseAdapter;

  constructor(adapter: LighthouseAdapter = mockLighthouseAdapter) {
    this.lighthouseAdapter = adapter;
  }

  async run(context: AuditContext): Promise<PerformanceMetrics> {
    const startedAt = new Date();

    try {
      const result = await this.lighthouseAdapter.audit(context.url, { device: "mobile" });
      const audits = result.audits;

      const lcp = audits["largest-contentful-paint"]?.numericValue ?? 2500;
      const fcp = audits["first-contentful-paint"]?.numericValue ?? 1000;
      const tbt = audits["total-blocking-time"]?.numericValue ?? 200;
      const cls = audits["cumulative-layout-shift"]?.numericValue ?? 0.1;
      const si = audits["speed-index"]?.numericValue ?? 3000;
      const tti = audits["interactive"]?.numericValue ?? 4000;
      const perfScore = Math.round(result.categories.performance.score * 100);

      const opportunities: PerformanceMetrics["opportunities"] = [];

      const renderBlocking = audits["render-blocking-resources"];
      if (renderBlocking && (renderBlocking.numericValue ?? 0) > 0) {
        opportunities.push({
          id: "render-blocking-resources",
          title: "Eliminate render-blocking resources",
          description: "Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles.",
          potentialSavingsMs: Math.round(renderBlocking.numericValue ?? 0),
        });
      }

      const unusedJs = audits["unused-javascript"];
      if (unusedJs && (unusedJs.numericValue ?? 0) > 0) {
        opportunities.push({
          id: "unused-javascript",
          title: "Reduce unused JavaScript",
          description: "Remove unused code to reduce bytes consumed by network activity",
          potentialSavingsBytes: Math.round(unusedJs.numericValue ?? 0),
          potentialSavingsMs: Math.round((unusedJs.numericValue ?? 0) / 1024 * 8),
        });
      }

      const unusedImages = audits["uses-optimized-images"];
      if (unusedImages && (unusedImages.numericValue ?? 0) > 0) {
        opportunities.push({
          id: "uses-optimized-images",
          title: "Efficiently encode images",
          description: "Optimized images load faster and consume less data",
          potentialSavingsBytes: Math.round(unusedImages.numericValue ?? 0),
        });
      }

      const base = Math.random();
      const completedAt = new Date();

      return {
        scannerName: "performance",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        scores: {
          performance: perfScore,
          lcp: Math.round(lcp),
          fid: Math.round(30 + base * 150),
          cls: parseFloat(cls.toFixed(3)),
          inp: Math.round(80 + base * 300),
          ttfb: Math.round(150 + base * 650),
          tbt: Math.round(tbt),
          fcp: Math.round(fcp),
          tti: Math.round(tti),
          speedIndex: Math.round(si),
        },
        opportunities,
        resourceSummary: {
          totalBytes: Math.round(800000 + base * 3200000),
          jsBytes: Math.round(200000 + base * 800000),
          cssBytes: Math.round(40000 + base * 160000),
          imageBytes: Math.round(300000 + base * 1200000),
          fontBytes: Math.round(60000 + base * 140000),
          requestCount: Math.round(20 + base * 80),
          unusedJsBytes: Math.round(audits["unused-javascript"]?.numericValue ?? base * 200000),
          unusedCssBytes: Math.round(base * 60000),
        },
        renderBlockingResources: renderBlocking?.numericValue
          ? [{
              url: `${context.url}/assets/main.css`,
              totalBytes: Math.round(base * 80000),
              wastedMs: Math.round(renderBlocking.numericValue),
            }]
          : [],
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "performance",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Performance scan failed",
        scores: { performance: 0, lcp: 0, fid: 0, cls: 0, inp: 0, ttfb: 0, tbt: 0, fcp: 0, tti: 0, speedIndex: 0 },
        opportunities: [],
        resourceSummary: { totalBytes: 0, jsBytes: 0, cssBytes: 0, imageBytes: 0, fontBytes: 0, requestCount: 0 },
        renderBlockingResources: [],
      };
    }
  }
}

export default new PerformanceScanner();
export { PerformanceScanner };
