// ─── Security Scanner ─────────────────────────────────────────────────────────
// Mock implementation. Replace with OWASP ZAP / Security Headers / Snyk.
// Interface: AuditScanner<SecurityAnalysis>

import type { AuditScanner, AuditContext, SecurityAnalysis } from "../audit-types";

// ─── Real Integration Adapter Interface ───────────────────────────────────────
// Implement to integrate with OWASP ZAP, Burp Suite API, or Snyk

export interface SecurityHeadersAdapter {
  analyze(url: string): Promise<{
    grade: string;
    headers: Record<string, string | null>;
    ssl: {
      valid: boolean;
      expiry: Date;
      protocol: string;
      grade: string;
    };
  }>;
}

const KNOWN_VULNERABILITIES = [
  {
    id: "csp-missing",
    severity: "high" as const,
    title: "Content Security Policy not configured",
    description: "No Content-Security-Policy header found. This leaves the application vulnerable to XSS attacks.",
    recommendation: "Implement a strict Content-Security-Policy header that restricts allowed script, style, and media sources.",
  },
  {
    id: "hsts-missing",
    severity: "medium" as const,
    title: "HTTP Strict Transport Security (HSTS) not set",
    description: "HSTS header is missing, allowing potential downgrade attacks from HTTPS to HTTP.",
    recommendation: "Add Strict-Transport-Security header with a max-age of at least 31536000 seconds.",
  },
  {
    id: "x-frame-missing",
    severity: "medium" as const,
    title: "Clickjacking protection missing",
    description: "X-Frame-Options header is not set, allowing the page to be embedded in iframes by malicious sites.",
    recommendation: "Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking attacks.",
  },
  {
    id: "cors-wildcard",
    severity: "high" as const,
    title: "Overly permissive CORS policy",
    description: "Access-Control-Allow-Origin: * detected on sensitive endpoints, allowing any origin to make cross-site requests.",
    recommendation: "Restrict CORS to specific trusted origins and avoid wildcard origins on authenticated endpoints.",
  },
  {
    id: "sri-missing",
    severity: "low" as const,
    title: "Subresource Integrity (SRI) not used",
    description: "Third-party scripts are loaded without Subresource Integrity hashes, risking supply chain attacks.",
    recommendation: "Add integrity and crossorigin attributes to all third-party <script> and <link> tags.",
  },
  {
    id: "cookie-insecure",
    severity: "medium" as const,
    title: "Session cookies missing security flags",
    description: "Cookies set without HttpOnly and Secure flags may be accessible via JavaScript or sent over HTTP.",
    recommendation: "Set HttpOnly, Secure, and SameSite=Strict on all session and authentication cookies.",
  },
  {
    id: "mixed-content",
    severity: "high" as const,
    title: "Mixed HTTP/HTTPS content detected",
    description: "Page loaded over HTTPS references resources via HTTP, which browsers block or flag as insecure.",
    recommendation: "Update all resource references to use HTTPS URLs.",
  },
  {
    id: "outdated-library",
    severity: "critical" as const,
    title: "Outdated JavaScript library with known CVE",
    description: "A third-party library version in use has a known security vulnerability (CVE).",
    cve: "CVE-2023-XXXX",
    cvssScore: 7.5,
    recommendation: "Update the affected library to the latest patched version immediately.",
  },
];

const mockSecurityAdapter: SecurityHeadersAdapter = {
  async analyze(url) {
    const rand = Math.random();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Math.round(30 + rand * 335));

    return {
      grade: rand > 0.6 ? "A" : rand > 0.4 ? "B" : rand > 0.2 ? "C" : "D",
      headers: {
        "content-security-policy": rand > 0.5 ? "default-src 'self'" : null,
        "strict-transport-security": rand > 0.4 ? "max-age=31536000; includeSubDomains" : null,
        "x-frame-options": rand > 0.5 ? "SAMEORIGIN" : null,
        "x-content-type-options": rand > 0.6 ? "nosniff" : null,
        "referrer-policy": rand > 0.5 ? "strict-origin-when-cross-origin" : null,
        "permissions-policy": rand > 0.6 ? "camera=(), microphone=(), geolocation=()" : null,
        "cross-origin-embedder-policy": rand > 0.7 ? "require-corp" : null,
        "cross-origin-opener-policy": rand > 0.7 ? "same-origin" : null,
      },
      ssl: {
        valid: true,
        expiry: expiryDate,
        protocol: rand > 0.8 ? "TLS 1.3" : "TLS 1.2",
        grade: rand > 0.6 ? "A+" : rand > 0.4 ? "A" : "B",
      },
    };
  },
};

class SecurityScanner implements AuditScanner<SecurityAnalysis> {
  readonly name = "security" as const;
  readonly description = "Scans security headers, SSL, cookies, and known vulnerabilities";
  readonly version = "1.0.0";
  readonly adapter = "security-headers";

  private securityAdapter: SecurityHeadersAdapter;

  constructor(adapter: SecurityHeadersAdapter = mockSecurityAdapter) {
    this.securityAdapter = adapter;
  }

  async run(context: AuditContext): Promise<SecurityAnalysis> {
    const startedAt = new Date();

    try {
      const result = await this.securityAdapter.analyze(context.url);
      const h = result.headers;
      const rand = Math.random();

      const headers: SecurityAnalysis["headers"] = {
        contentSecurityPolicy: !!h["content-security-policy"],
        strictTransportSecurity: !!h["strict-transport-security"],
        xFrameOptions: !!h["x-frame-options"],
        xContentTypeOptions: !!h["x-content-type-options"],
        referrerPolicy: !!h["referrer-policy"],
        permissionsPolicy: !!h["permissions-policy"],
        crossOriginEmbedderPolicy: !!h["cross-origin-embedder-policy"],
        crossOriginOpenerPolicy: !!h["cross-origin-opener-policy"],
      };

      // Select relevant vulnerabilities
      const vulnerabilities: SecurityAnalysis["vulnerabilities"] = [];
      if (!headers.contentSecurityPolicy) vulnerabilities.push(KNOWN_VULNERABILITIES[0]);
      if (!headers.strictTransportSecurity) vulnerabilities.push(KNOWN_VULNERABILITIES[1]);
      if (!headers.xFrameOptions) vulnerabilities.push(KNOWN_VULNERABILITIES[2]);
      if (rand > 0.7) vulnerabilities.push(KNOWN_VULNERABILITIES[3]);
      if (rand > 0.5) vulnerabilities.push(KNOWN_VULNERABILITIES[4]);
      if (rand > 0.6) vulnerabilities.push(KNOWN_VULNERABILITIES[5]);
      if (rand > 0.8) vulnerabilities.push(KNOWN_VULNERABILITIES[6]);
      if (rand > 0.9) vulnerabilities.push(KNOWN_VULNERABILITIES[7]);

      // Score calculation
      const headerScore = (Object.values(headers).filter(Boolean).length / 8) * 40;
      const sslScore = result.ssl.valid ? 30 : 0;
      const vulnPenalty = vulnerabilities.reduce((acc, v) => {
        const weights = { critical: 20, high: 12, medium: 6, low: 3, info: 1 };
        return acc + (weights[v.severity] ?? 0);
      }, 0);
      const score = Math.max(0, Math.min(100, Math.round(headerScore + sslScore + 30 - vulnPenalty)));

      const expiresInDays = Math.round(
        (result.ssl.expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const completedAt = new Date();
      return {
        scannerName: "security",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        score,
        ssl: {
          valid: result.ssl.valid,
          expiresInDays,
          grade: result.ssl.grade,
          protocol: result.ssl.protocol,
          cipherStrength: result.ssl.grade === "A+" || result.ssl.grade === "A" ? "strong" : "acceptable",
          hsts: headers.strictTransportSecurity,
          hstsPreload: h["strict-transport-security"]?.includes("preload") ?? false,
        },
        headers,
        vulnerabilities,
        mixedContent: rand > 0.75,
        cookieSecurity: {
          httpOnly: rand > 0.5,
          secure: rand > 0.4,
          sameSite: rand > 0.5,
          issues: rand > 0.6 ? ["Session cookie missing SameSite attribute"] : [],
        },
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "security",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Security scan failed",
        score: 0,
        ssl: { valid: false, expiresInDays: 0, grade: "F", protocol: "Unknown", cipherStrength: "weak", hsts: false, hstsPreload: false },
        headers: { contentSecurityPolicy: false, strictTransportSecurity: false, xFrameOptions: false, xContentTypeOptions: false, referrerPolicy: false, permissionsPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false },
        vulnerabilities: [],
        mixedContent: false,
        cookieSecurity: { httpOnly: false, secure: false, sameSite: false, issues: [] },
      };
    }
  }
}

export default new SecurityScanner();
export { SecurityScanner };
