// ─── Screenshot Capture ───────────────────────────────────────────────────────
// Real implementation using Playwright to capture full-page and viewport
// screenshots across desktop, tablet, and mobile breakpoints.

import type { AuditScanner, AuditContext, ScreenshotResult } from "../audit-types";
import { withPage } from "./playwright-browser";

export interface ScreenshotAdapter {
  capture(url: string, options: {
    viewport: { width: number; height: number };
    deviceType: "desktop" | "tablet" | "mobile";
    fullPage?: boolean;
  }): Promise<{
    dataUrl: string;
    fileSizeBytes: number;
    format: "webp" | "png" | "jpeg";
  }>;
}

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 390,  height: 844  },
} as const;

// ─── Real adapter: Playwright screenshots ────────────────────────────────────

const realScreenshotAdapter: ScreenshotAdapter = {
  async capture(url, options) {
    return withPage(
      async (page) => {
        await page.setViewportSize(options.viewport);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        // Give JS a moment to render
        await page.waitForTimeout(1500);

        const buffer = await page.screenshot({
          type: "jpeg",
          quality: 80,
          fullPage: options.fullPage ?? false,
        });

        const dataUrl = "data:image/jpeg;base64," + buffer.toString("base64");
        return {
          dataUrl,
          fileSizeBytes: buffer.length,
          format: "jpeg" as const,
        };
      },
      { timeoutMs: 30000 },
    );
  },
};

class ScreenshotCapture implements AuditScanner<ScreenshotResult> {
  readonly name = "screenshot" as const;
  readonly description = "Captures screenshots across desktop, tablet, and mobile viewports using Playwright";
  readonly version = "2.0.0";
  readonly adapter = "playwright";

  private screenshotAdapter: ScreenshotAdapter;

  constructor(adapter: ScreenshotAdapter = realScreenshotAdapter) {
    this.screenshotAdapter = adapter;
  }

  async run(context: AuditContext): Promise<ScreenshotResult> {
    const startedAt = new Date();
    const devices = context.options?.screenshotDevices ?? ["desktop", "tablet", "mobile"];

    try {
      const screenshots: ScreenshotResult["screenshots"] = [];

      for (const deviceType of devices) {
        const viewport = VIEWPORTS[deviceType];
        const capture = await this.screenshotAdapter.capture(context.url, {
          viewport,
          deviceType,
          fullPage: false,
        });
        screenshots.push({
          deviceType,
          viewport,
          dataUrl: capture.dataUrl,
          fileSizeBytes: capture.fileSizeBytes,
          format: capture.format,
          capturedAt: new Date(),
        });
      }

      // Full-page desktop screenshot
      const fullPage = await this.screenshotAdapter.capture(context.url, {
        viewport: VIEWPORTS.desktop,
        deviceType: "desktop",
        fullPage: true,
      });

      const completedAt = new Date();
      return {
        scannerName: "screenshot",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        screenshots,
        fullPageScreenshot: {
          dataUrl: fullPage.dataUrl,
          dimensions: {
            width: VIEWPORTS.desktop.width,
            height: VIEWPORTS.desktop.height * 3,
          },
        },
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "screenshot",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Screenshot capture failed",
        screenshots: [],
      };
    }
  }
}

export default new ScreenshotCapture();
export { ScreenshotCapture };
