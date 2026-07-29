// ─── Scanner Registry ─────────────────────────────────────────────────────────
// Central export point for all audit scanners.
// To replace a scanner with a real implementation, swap the default export here.

export { default as performanceScanner, PerformanceScanner } from "./performance-scanner";
export { default as accessibilityScanner, AccessibilityScanner } from "./accessibility-scanner";
export { default as seoScanner, SEOScanner } from "./seo-scanner";
export { default as securityScanner, SecurityScanner } from "./security-scanner";
export { default as brokenLinkScanner, BrokenLinkScanner } from "./broken-link-scanner";
export { default as consoleErrorCollector, ConsoleErrorCollector } from "./console-error-collector";
export { default as networkAnalyzer, NetworkAnalyzer } from "./network-analyzer";
export { default as screenshotCapture, ScreenshotCapture } from "./screenshot-capture";
export { default as technologyDetector, TechnologyDetector } from "./technology-detector";
export { default as aiSummaryGenerator, AISummaryGenerator } from "./ai-summary-generator";

// Re-export all adapter interfaces for consumers that want to inject real implementations
export type { LighthouseAdapter } from "./performance-scanner";
export type { AxeCoreAdapter } from "./accessibility-scanner";
export type { SEOAdapter } from "./seo-scanner";
export type { SecurityHeadersAdapter } from "./security-scanner";
export type { BrokenLinkAdapter } from "./broken-link-scanner";
export type { BrowserConsoleAdapter } from "./console-error-collector";
export type { NetworkHARAdapter } from "./network-analyzer";
export type { ScreenshotAdapter } from "./screenshot-capture";
export type { TechDetectionAdapter } from "./technology-detector";
export type { LLMAdapter, AISummaryInput } from "./ai-summary-generator";
