// ─── Screenshot Capture ───────────────────────────────────────────────────────
// Uses Playwright to capture viewport and full-page screenshots across
// desktop, tablet, and mobile breakpoints.
// Stores real metadata: actual page dimensions, capture timestamp, file size.

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
    pageWidth: number;
    pageHeight: number;
    captureTimeMs: number;
  }>;
}

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 390,  height: 844  },
} as const;

// ─── Real adapter ─────────────────────────────────────────────────────────────

const realScreenshotAdapter: ScreenshotAdapter = {
  async capture(url, options) {
    return withPage(
      async (page) => {
        await page.setViewportSize(options.viewport);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        // Allow JS frameworks to finish rendering
        await page.waitForTimeout(1500);

        // Measure actual page dimensions
        const pageDimensions = await page.evaluate(() => ({
          pageWidth:  Math.max(document.body.scrollWidth,  document.documentElement.scrollWidth),
          pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        }));

        const captureStart = Date.now();
        const buffer = await page.screenshot({
          type: "jpeg",
          quality: 80,
          fullPage: options.fullPage ?? false,
        });
        const captureTimeMs = Date.now() - captureStart;

        const dataUrl = "data:image/jpeg;base64," + buffer.toString("base64");
        return {
          dataUrl,
          fileSizeBytes: buffer.length,
          format: "jpeg" as const,
          pageWidth:  pageDimensions.pageWidth,
          pageHeight: pageDimensions.pageHeight,
          captureTimeMs,
        };
      },
      { timeoutMs: 35000 },
    );
  },
};

class ScreenshotCapture implements AuditScanner<ScreenshotResult> {
  readonly name = "screenshot" as const;
  readonly description =
    "Playwright screenshots: desktop, tablet, mobile viewports + full-page; stores real dimensions and capture metadata";
  readonly version = "3.0.0";
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

      // Full-page desktop screenshot — uses real page height for dimensions
      const fullPageCapture = await this.screenshotAdapter.capture(context.url, {
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
          dataUrl: fullPageCapture.dataUrl,
          dimensions: {
            width:  fullPageCapture.pageWidth  || VIEWPORTS.desktop.width,
            height: fullPageCapture.pageHeight || VIEWPORTS.desktop.height,
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
