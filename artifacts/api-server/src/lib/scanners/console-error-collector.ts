// ─── Console Error Collector ──────────────────────────────────────────────────
// Real implementation using Playwright to capture browser console messages,
// uncaught JS exceptions, and failed network requests during page load.

import type { AuditScanner, AuditContext, ConsoleErrors } from "../audit-types";
import { withPage } from "./playwright-browser";

export interface BrowserConsoleAdapter {
  collect(url: string, options?: { timeout?: number }): Promise<{
    logs: Array<{
      level: "error" | "warning" | "info" | "verbose";
      message: string;
      source?: string;
      lineNumber?: number;
    }>;
    uncaughtExceptions: number;
    failedRequests: Array<{
      url: string;
      method: string;
      statusCode: number;
      errorMessage?: string;
    }>;
  }>;
}

// ─── Real adapter: Playwright CDP console monitoring ─────────────────────────

const realConsoleAdapter: BrowserConsoleAdapter = {
  async collect(url, options = {}) {
    return withPage(async (page) => {
      const logs: Array<{
        level: "error" | "warning" | "info" | "verbose";
        message: string;
        source?: string;
        lineNumber?: number;
      }> = [];
      let uncaughtExceptions = 0;
      const failedRequests: Array<{ url: string; method: string; statusCode: number; errorMessage?: string }> = [];

      // ── Capture console messages ─────────────────────────────────────────
      page.on("console", (msg) => {
        const type = msg.type();
        // Map Playwright console types to ConsoleErrors levels
        const level: "error" | "warning" | "info" | "verbose" =
          type === "error"   ? "error"   :
          type === "warning" ? "warning" :
          type === "info"    ? "info"    :
          "verbose";

        logs.push({
          level,
          message: msg.text(),
          source: msg.location().url || undefined,
          lineNumber: msg.location().lineNumber || undefined,
        });
      });

      // ── Capture uncaught JS exceptions ───────────────────────────────────
      page.on("pageerror", () => {
        uncaughtExceptions++;
      });

      // ── Capture failed network requests ──────────────────────────────────
      page.on("requestfailed", (req) => {
        failedRequests.push({
          url: req.url(),
          method: req.method(),
          statusCode: 0,
          errorMessage: req.failure()?.errorText ?? "Request failed",
        });
      });

      page.on("response", (res) => {
        if (res.status() >= 400) {
          failedRequests.push({
            url: res.url(),
            method: res.request().method(),
            statusCode: res.status(),
          });
        }
      });

      // ── Navigate and wait ────────────────────────────────────────────────
      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: options.timeout ?? 25000,
        });
      } catch {
        // Timeout is acceptable — we still return whatever was captured
      }

      await page.waitForTimeout(1000);

      return { logs, uncaughtExceptions, failedRequests };
    }, { timeoutMs: 35000 });
  },
};

class ConsoleErrorCollector implements AuditScanner<ConsoleErrors> {
  readonly name = "console-errors" as const;
  readonly description = "Captures browser console errors, JS exceptions, and failed requests via Playwright";
  readonly version = "2.0.0";
  readonly adapter = "playwright-cdp";

  private consoleAdapter: BrowserConsoleAdapter;

  constructor(adapter: BrowserConsoleAdapter = realConsoleAdapter) {
    this.consoleAdapter = adapter;
  }

  async run(context: AuditContext): Promise<ConsoleErrors> {
    const startedAt = new Date();

    try {
      const { logs, uncaughtExceptions, failedRequests } =
        await this.consoleAdapter.collect(context.url, { timeout: 25000 });

      const errorLogs   = logs.filter(l => l.level === "error");
      const warningLogs = logs.filter(l => l.level === "warning");

      const completedAt = new Date();
      return {
        scannerName: "console-errors",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        // All log levels go into errors[] — warnings are included with level "warning"
        errors: logs.map(e => ({
          level: e.level,
          message: e.message,
          source: e.source,
          lineNumber: e.lineNumber,
        })),
        totalErrors: errorLogs.length + uncaughtExceptions,
        totalWarnings: warningLogs.length,
        uncaughtExceptions,
        failedRequests,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "console-errors",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Console error collection failed",
        errors: [],
        totalErrors: 0,
        totalWarnings: 0,
        uncaughtExceptions: 0,
        failedRequests: [],
      };
    }
  }
}

export default new ConsoleErrorCollector();
export { ConsoleErrorCollector };
