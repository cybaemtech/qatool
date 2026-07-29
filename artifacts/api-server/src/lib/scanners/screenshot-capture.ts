// ─── Screenshot Capture ───────────────────────────────────────────────────────
// Mock implementation. Replace with Playwright / Puppeteer screenshot API.
// Interface: AuditScanner<ScreenshotResult>

import type { AuditScanner, AuditContext, ScreenshotResult } from "../audit-types";

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

// 1×1 transparent WebP placeholder (replace with real screenshot in production)
const PLACEHOLDER_WEBP = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAkA4JZQCdAEO/gHOAAA=";

const mockScreenshotAdapter: ScreenshotAdapter = {
  async capture(_url, options) {
    // In production: return actual Playwright screenshot as base64 WebP
    const sizeMap = { desktop: 18400, tablet: 12800, mobile: 8200 };
    return {
      dataUrl: PLACEHOLDER_WEBP,
      fileSizeBytes: sizeMap[options.deviceType],
      format: "webp",
    };
  },
};

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

class ScreenshotCapture implements AuditScanner<ScreenshotResult> {
  readonly name = "screenshot" as const;
  readonly description = "Captures full-page screenshots across desktop, tablet, and mobile viewports";
  readonly version = "1.0.0";
  readonly adapter = "playwright-screenshot";

  private screenshotAdapter: ScreenshotAdapter;

  constructor(adapter: ScreenshotAdapter = mockScreenshotAdapter) {
    this.screenshotAdapter = adapter;
  }

  async run(context: AuditContext): Promise<ScreenshotResult> {
    const startedAt = new Date();
    const devices = context.options?.screenshotDevices ?? ["desktop", "tablet", "mobile"];

    try {
      const screenshots: ScreenshotResult["screenshots"] = [];
      for (const deviceType of devices) {
        const viewport = VIEWPORTS[deviceType];
        const capture = await this.screenshotAdapter.capture(context.url, { viewport, deviceType, fullPage: false });
        screenshots.push({
          deviceType,
          viewport,
          dataUrl: capture.dataUrl,
          fileSizeBytes: capture.fileSizeBytes,
          format: capture.format,
          capturedAt: new Date(),
        });
      }

      // Optional full-page desktop screenshot
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
          dimensions: { width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height * 3 },
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
