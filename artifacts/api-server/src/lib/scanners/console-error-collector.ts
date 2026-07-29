// ─── Console Error Collector ──────────────────────────────────────────────────
// Mock implementation. Replace with Playwright CDP / Puppeteer page.on('console').
// Interface: AuditScanner<ConsoleErrors>

import type { AuditScanner, AuditContext, ConsoleErrors } from "../audit-types";

export interface BrowserConsoleAdapter {
  collect(url: string, options?: { waitMs?: number }): Promise<{
    consoleMessages: Array<{
      level: "error" | "warning" | "info" | "verbose";
      message: string;
      source?: string;
      lineNumber?: number;
      stackTrace?: string;
    }>;
    networkFailures: Array<{
      url: string;
      method: string;
      statusCode: number;
      errorMessage?: string;
    }>;
    uncaughtExceptions: number;
  }>;
}

const mockBrowserConsoleAdapter: BrowserConsoleAdapter = {
  async collect(url) {
    const rand = Math.random();

    const messages: ConsoleErrors["errors"] = [];
    const failedRequests: ConsoleErrors["failedRequests"] = [];
    let uncaught = 0;

    if (rand > 0.6) {
      messages.push({
        level: "error",
        message: "Uncaught TypeError: Cannot read properties of undefined (reading 'data')",
        source: `${url}/assets/app.js`,
        lineNumber: 1847,
        columnNumber: 23,
        stackTrace: `TypeError: Cannot read properties of undefined\n  at Object.render (app.js:1847:23)\n  at HTMLButtonElement.onclick`,
      });
      uncaught++;
    }

    if (rand > 0.5) {
      messages.push({
        level: "warning",
        message: "WARN: Failed to load resource: the server responded with a status of 403 (Forbidden)",
        source: `${url}/api/v1/features`,
        lineNumber: undefined,
      });
      failedRequests.push({
        url: `${url}/api/v1/features`,
        method: "GET",
        statusCode: 403,
        errorMessage: "Forbidden",
      });
    }

    if (rand > 0.3) {
      messages.push({
        level: "warning",
        message: "React: Each child in a list should have a unique 'key' prop",
        source: `${url}/assets/vendor.js`,
        lineNumber: 42,
      });
    }

    if (rand > 0.8) {
      messages.push({
        level: "error",
        message: "SyntaxError: Unexpected token '<' — API returned HTML instead of JSON",
        source: `${url}/api/v2/data`,
        lineNumber: 1,
        columnNumber: 1,
      });
      failedRequests.push({
        url: `${url}/api/v2/data`,
        method: "POST",
        statusCode: 500,
        errorMessage: "Internal Server Error",
      });
    }

    if (rand > 0.4) {
      messages.push({
        level: "info",
        message: "[webpack-dev-server] Server started: Hot Module Replacement enabled",
      });
    }

    if (rand > 0.7) {
      failedRequests.push({
        url: `https://analytics.example.com/track`,
        method: "POST",
        statusCode: 0,
        errorMessage: "net::ERR_BLOCKED_BY_CLIENT",
      });
    }

    return {
      consoleMessages: messages,
      networkFailures: failedRequests,
      uncaughtExceptions: uncaught,
    };
  },
};

class ConsoleErrorCollector implements AuditScanner<ConsoleErrors> {
  readonly name = "console-errors" as const;
  readonly description = "Captures browser console errors, warnings, and failed network requests";
  readonly version = "1.0.0";
  readonly adapter = "playwright-cdp";

  private browserAdapter: BrowserConsoleAdapter;

  constructor(adapter: BrowserConsoleAdapter = mockBrowserConsoleAdapter) {
    this.browserAdapter = adapter;
  }

  async run(context: AuditContext): Promise<ConsoleErrors> {
    const startedAt = new Date();

    try {
      const result = await this.browserAdapter.collect(context.url, { waitMs: 5000 });

      const completedAt = new Date();
      return {
        scannerName: "console-errors",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        errors: result.consoleMessages,
        totalErrors: result.consoleMessages.filter(m => m.level === "error").length,
        totalWarnings: result.consoleMessages.filter(m => m.level === "warning").length,
        uncaughtExceptions: result.uncaughtExceptions,
        failedRequests: result.networkFailures,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "console-errors",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Console collection failed",
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
