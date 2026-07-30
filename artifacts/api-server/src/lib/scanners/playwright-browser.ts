// ─── Shared Playwright Browser Utility ───────────────────────────────────────
// Provides a single launch helper so all scanners share the same browser
// binary path and launch flags. Uses the Chromium downloaded during setup.

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "path";
import os from "os";

// Chromium is downloaded to this path by `playwright install chromium`
const BROWSERS_ROOT =
  process.env.PLAYWRIGHT_BROWSERS_PATH ??
  path.join(os.homedir(), ".cache", "ms-playwright");

const CHROME_PATH = path.join(
  BROWSERS_ROOT,
  "chromium-1234",
  "chrome-linux64",
  "chrome",
);

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--mute-audio",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
];

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: LAUNCH_ARGS,
  });
}

/** Run a callback with a fresh browser + context + page, then close the browser. */
export async function withPage<T>(
  cb: (page: Page, context: BrowserContext) => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    context.setDefaultTimeout(options.timeoutMs ?? 30000);
    const page = await context.newPage();
    try {
      return await cb(page, context);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
