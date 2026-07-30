// ─── Shared Playwright Browser Utility ───────────────────────────────────────
// Provides a single launch helper so all scanners share the same browser
// binary path and launch flags.
//
// Resolution order for the Chromium executable:
//   1. PLAYWRIGHT_BROWSER_PATH env var (explicit override)
//   2. System `chromium` binary found via PATH (installed by Nix / pkgs.chromium)
//   3. Playwright's own downloaded binary under ~/workspace/.cache/ms-playwright

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { spawnSync } from "child_process";
import path from "path";
import os from "os";

function resolveChromiumPath(): string | undefined {
  // 1. Explicit override
  if (process.env.PLAYWRIGHT_BROWSER_PATH) return process.env.PLAYWRIGHT_BROWSER_PATH;

  // 2. System Chromium from PATH (pkgs.chromium via Nix)
  try {
    const result = spawnSync("which", ["chromium"], { encoding: "utf8" });
    const found = result.stdout?.trim();
    if (found) return found;
  } catch {
    // ignore
  }

  // 3. Playwright's downloaded Chromium (installed via `playwright install chromium`)
  const playwrightCache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    path.join(os.homedir(), "workspace", ".cache", "ms-playwright");
  return path.join(playwrightCache, "chromium-1234", "chrome-linux64", "chrome");
}

export const CHROMIUM_EXECUTABLE = resolveChromiumPath();

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
];

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: CHROMIUM_EXECUTABLE,
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
