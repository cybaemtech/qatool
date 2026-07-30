// ─── Scanner Registry ─────────────────────────────────────────────────────────
// Maintains the ordered list of scanners for the audit pipeline.
// Inject real adapters (Lighthouse, Playwright, axe-core, OWASP) here —
// the pipeline itself needs no changes.

import type { AuditScanner, ScannerResponse, AuditContext, ScannerName } from "./audit-types";
import {
  performanceScanner,
  accessibilityScanner,
  seoScanner,
  securityScanner,
  brokenLinkScanner,
  consoleErrorCollector,
  networkAnalyzer,
  screenshotCapture,
  technologyDetector,
  aiSummaryGenerator,
} from "./scanners/index";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RegisteredScanner {
  scanner: AuditScanner<ScannerResponse>;
  /** Human-readable stage label shown in the UI timeline */
  stageLabel: string;
  /** Order in the pipeline (lower = earlier) */
  order: number;
  /** Whether a failure in this scanner should abort the entire pipeline */
  critical: boolean;
}

export interface ScannerRegistry {
  /** Return all scanners in pipeline order */
  getAll(): RegisteredScanner[];

  /** Look up a scanner by name */
  get(name: ScannerName): RegisteredScanner | undefined;

  /**
   * Replace a mock scanner with a real adapter.
   * Usage: registry.replace("performance", myLighthouseScanner)
   */
  replace(name: ScannerName, scanner: AuditScanner<ScannerResponse>): void;
}

// ─── Default registry ─────────────────────────────────────────────────────────

class DefaultScannerRegistry implements ScannerRegistry {
  private scanners: Map<ScannerName, RegisteredScanner>;

  constructor() {
    const entries: RegisteredScanner[] = [
      {
        scanner: performanceScanner as AuditScanner<ScannerResponse>,
        stageLabel: "Running Performance Scanner",
        order: 1,
        critical: false,
      },
      {
        scanner: accessibilityScanner as AuditScanner<ScannerResponse>,
        stageLabel: "Running Accessibility Scanner",
        order: 2,
        critical: false,
      },
      {
        scanner: seoScanner as AuditScanner<ScannerResponse>,
        stageLabel: "Running SEO Scanner",
        order: 3,
        critical: false,
      },
      {
        scanner: securityScanner as AuditScanner<ScannerResponse>,
        stageLabel: "Running Security Scanner",
        order: 4,
        critical: false,
      },
      {
        scanner: brokenLinkScanner as AuditScanner<ScannerResponse>,
        stageLabel: "Scanning for Broken Links",
        order: 5,
        critical: false,
      },
      {
        scanner: consoleErrorCollector as AuditScanner<ScannerResponse>,
        stageLabel: "Collecting Console Errors",
        order: 6,
        critical: false,
      },
      {
        scanner: networkAnalyzer as AuditScanner<ScannerResponse>,
        stageLabel: "Analyzing Network Requests",
        order: 7,
        critical: false,
      },
      {
        scanner: screenshotCapture as AuditScanner<ScannerResponse>,
        stageLabel: "Capturing Screenshots",
        order: 8,
        critical: false,
      },
      {
        scanner: technologyDetector as AuditScanner<ScannerResponse>,
        stageLabel: "Detecting Technologies",
        order: 9,
        critical: false,
      },
      {
        scanner: aiSummaryGenerator as AuditScanner<ScannerResponse>,
        stageLabel: "Generating AI Summary",
        order: 10,
        critical: false,
      },
    ];

    this.scanners = new Map(entries.map((e) => [e.scanner.name, e]));
  }

  getAll(): RegisteredScanner[] {
    return Array.from(this.scanners.values()).sort((a, b) => a.order - b.order);
  }

  get(name: ScannerName): RegisteredScanner | undefined {
    return this.scanners.get(name);
  }

  replace(name: ScannerName, scanner: AuditScanner<ScannerResponse>): void {
    const existing = this.scanners.get(name);
    if (!existing) throw new Error(`Scanner "${name}" is not registered`);
    this.scanners.set(name, { ...existing, scanner });
  }
}

export const scannerRegistry: ScannerRegistry = new DefaultScannerRegistry();
export { DefaultScannerRegistry };
