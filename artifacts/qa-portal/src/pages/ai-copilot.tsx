import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Bot, Sparkles, Send, User, Loader2, Copy, Check, RotateCcw,
  Square, Mic, Plus, Trash2, MessageSquare, Sun, Moon, ChevronRight,
  Zap, FileCode2, FileText, Bug, Activity, Database, BookOpen,
  TestTube, GitBranch, AlertTriangle, Code2, BarChart3, Package,
  X, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mock Response Engine ─────────────────────────────────────────────────────

const RESPONSES: Array<{ pattern: RegExp; response: string }> = [
  // ── Generate Login Test Cases ──────────────────────────────────────────────
  {
    pattern: /login.*test|test.*login|sign.in.*test|auth.*test/i,
    response: `## Login Test Cases — E2E Suite

Here's a comprehensive Playwright test suite covering authentication scenarios:

\`\`\`typescript
// tests/auth/login.spec.ts
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://staging.acme.com';

test.describe('Authentication — Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(\`\${BASE_URL}/login\`);
  });

  test('TC-AUTH-001 | Happy path — valid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'admin@acme.com');
    await page.fill('[data-testid="password"]', 'SecurePass#2024');
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('TC-AUTH-002 | Invalid password shows error toast', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'admin@acme.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Invalid email or password');
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-003 | Non-existent email shows generic error', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'ghost@notreal.com');
    await page.fill('[data-testid="password"]', 'AnyPass123');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Invalid email or password');
  });

  test('TC-AUTH-004 | Empty form submission triggers validation', async ({ page }) => {
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('TC-AUTH-005 | Malformed email rejects client-side', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'not-an-email');
    await page.fill('[data-testid="password"]', 'AnyPass123');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('text=Enter a valid email address')).toBeVisible();
  });

  test('TC-AUTH-006 | Account lockout after 5 failed attempts', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="email"]', 'lockout@acme.com');
      await page.fill('[data-testid="password"]', \`badpass\${i}\`);
      await page.click('[data-testid="login-btn"]');
      await page.waitForTimeout(300);
    }
    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Account locked. Try again in 15 minutes');
  });

  test('TC-AUTH-007 | SQL injection attempt is sanitised', async ({ page }) => {
    await page.fill('[data-testid="email"]', "admin'--");
    await page.fill('[data-testid="password"]', "' OR '1'='1");
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Invalid email or password');
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-008 | Remember me persists session across tabs', async ({ page, context }) => {
    await page.fill('[data-testid="email"]', 'admin@acme.com');
    await page.fill('[data-testid="password"]', 'SecurePass#2024');
    await page.check('[data-testid="remember-me"]');
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL(/.*dashboard/);
    const newPage = await context.newPage();
    await newPage.goto(\`\${BASE_URL}/dashboard\`);
    await expect(newPage).toHaveURL(/.*dashboard/);
  });

  test('TC-AUTH-009 | Session expires after 30 min of inactivity', async ({ page }) => {
    // Authenticate
    await page.fill('[data-testid="email"]', 'admin@acme.com');
    await page.fill('[data-testid="password"]', 'SecurePass#2024');
    await page.click('[data-testid="login-btn"]');
    // Simulate token expiry by manipulating localStorage
    await page.evaluate(() => localStorage.setItem('qa-portal-token', 'expired.token.here'));
    await page.goto(\`\${BASE_URL}/projects\`);
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('text=Your session has expired')).toBeVisible();
  });

  test('TC-AUTH-010 | Logout clears session and redirects', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'admin@acme.com');
    await page.fill('[data-testid="password"]', 'SecurePass#2024');
    await page.click('[data-testid="login-btn"]');
    await page.click('[data-testid="logout-btn"]');
    await expect(page).toHaveURL(/.*login/);
    await page.goto(\`\${BASE_URL}/dashboard\`);
    await expect(page).toHaveURL(/.*login/);
  });
});
\`\`\`

### Test Coverage Summary

| Category | Test Count | Priority |
|---|---|---|
| Happy path | 1 | P0 |
| Invalid credentials | 2 | P0 |
| Input validation | 2 | P1 |
| Security (lockout, injection) | 2 | P0 |
| Session management | 3 | P1 |
| **Total** | **10** | — |

> **Tip:** Add these to your CI pipeline with \`npx playwright test tests/auth/\` — they run in ~12 seconds on Chrome headless.`,
  },

  // ── Explain Failed API ─────────────────────────────────────────────────────
  {
    pattern: /explain.*fail|fail.*api|api.*error|500|401|403|api.*fail/i,
    response: `## API Failure Analysis

### Request Details

\`\`\`
POST /api/v2/orders
Status: 500 Internal Server Error
Latency: 8,421ms (timeout threshold: 5,000ms)
Request ID: req_01HX9V3K2MZPQN8WJVT4YDBRG
Timestamp: 2024-01-15T14:32:07.843Z
\`\`\`

### Response Payload

\`\`\`json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_01HX9V3K2MZPQN8WJVT4YDBRG",
    "timestamp": "2024-01-15T14:32:07.843Z"
  }
}
\`\`\`

### Root Cause Analysis

The 500 error originates from an unhandled database connection timeout in the order processing pipeline. The stack trace from the server logs reveals:

\`\`\`
Error: Connection timeout after 8000ms
  at Pool.connect (node_modules/pg/lib/pool.js:181:13)
  at OrderService.createOrder (src/services/orders.service.ts:94:22)
  at OrdersController.create (src/controllers/orders.controller.ts:47:18)
\`\`\`

**Immediate causes:**
1. The PostgreSQL connection pool is exhausted (pool size: 10, active: 10, waiting: 7)
2. A long-running transaction from a background analytics job holds 6 connections for >60s
3. No circuit breaker is configured — all requests pile up instead of failing fast

### Impact Assessment

| Dimension | Value |
|---|---|
| Affected endpoints | \`POST /api/v2/orders\`, \`GET /api/v2/orders/:id\` |
| Error rate (last 15min) | **34%** |
| Affected users | ~1,200 |
| Revenue impact | ~$18,400 |
| SLA breach | Yes — P1 |

### Recommended Fixes

**Immediate (deploy now):**
\`\`\`typescript
// 1. Increase pool size and set statement timeout
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 25,                    // was: 10
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 15000,   // kill runaway queries
});

// 2. Add circuit breaker around DB calls
const breaker = new CircuitBreaker(pool.query.bind(pool), {
  timeout: 4000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});
\`\`\`

**Short-term (this sprint):**
- Move analytics aggregation jobs to a read replica
- Add \`pg_bouncer\` as connection pooler in front of primary DB
- Implement retry with exponential backoff (max 3 attempts, 1s/2s/4s)

**Long-term:**
- Separate OLTP and OLAP workloads into distinct DB clusters
- Implement async order processing with a queue (BullMQ / SQS)`,
  },

  // ── Create Regression Suite ────────────────────────────────────────────────
  {
    pattern: /regression.*suite|regression.*plan|create.*regression|regression.*test/i,
    response: `## Regression Test Suite — v2.4.0 Release

### Scope & Objectives

This regression suite covers all critical user journeys affected by the v2.4.0 changes: **order management refactor**, **notification engine upgrade**, and **role-based permission overhaul**.

---

### Priority 1 — Smoke Tests (Run on every build, ~8 min)

| ID | Test Case | Owner | Automated |
|---|---|---|---|
| REG-S01 | User can log in with valid credentials | QA | ✅ |
| REG-S02 | Dashboard loads within 3 seconds | QA | ✅ |
| REG-S03 | Create a new project | QA | ✅ |
| REG-S04 | Submit a support ticket | QA | ✅ |
| REG-S05 | API health endpoint returns 200 | QA | ✅ |

---

### Priority 2 — Core Flows (Run on every PR merge, ~35 min)

**Authentication & Authorization**

| ID | Test Case | Expected Result |
|---|---|---|
| REG-A01 | Admin can access User Management | ✅ Access granted |
| REG-A02 | Tester cannot access User Management | 403 Forbidden |
| REG-A03 | Expired token redirects to login | Redirect to /login |
| REG-A04 | Password reset sends email within 60s | Email received |

**Order Management (Changed in v2.4.0)**

| ID | Test Case | Expected Result |
|---|---|---|
| REG-O01 | Create order with all required fields | Order ID returned, status=pending |
| REG-O02 | Update order status — pending → processing | Status updated, webhook fired |
| REG-O03 | Cancel order within cancellation window | Refund initiated, status=cancelled |
| REG-O04 | Bulk order export (1,000 rows) completes < 10s | CSV downloaded |
| REG-O05 | Order search by date range and status | Filtered results returned |

**Notifications (Changed in v2.4.0)**

| ID | Test Case | Expected Result |
|---|---|---|
| REG-N01 | Email notification sent on order creation | Email delivered within 90s |
| REG-N02 | In-app notification appears in real time | Notification visible < 2s |
| REG-N03 | Mark all notifications as read | Badge count resets to 0 |
| REG-N04 | Notification preferences respected | Unsubscribed channels silent |

---

### Priority 3 — Edge Cases & Boundaries (Run nightly)

\`\`\`
REG-E01  Order with 500 line items (max allowed)
REG-E02  Concurrent updates to same order by two users
REG-E03  File upload exactly at 25 MB limit
REG-E04  API request with Unicode characters in all text fields
REG-E05  Pagination at last page with fewer items than page size
REG-E06  Timezone handling — order created in UTC-8, viewed in UTC+9
REG-E07  Session persistence across browser restart (remember me = on)
REG-E08  Dashboard with 0 projects, 0 audits (empty state)
\`\`\`

---

### Execution Plan

\`\`\`
Day 1 AM  →  Priority 1 (automated, ~8 min) — ALL PASS required before merge
Day 1 PM  →  Priority 2 (automated + manual, ~35 min)
Day 2     →  Priority 3 (nightly pipeline) + exploratory testing
Day 3     →  Defect verification + sign-off
\`\`\`

### Exit Criteria
- 0 P0/P1 open defects
- ≥95% automated test pass rate
- All Priority 1 & 2 cases executed and signed off`,
  },

  // ── Generate Bug Report ────────────────────────────────────────────────────
  {
    pattern: /bug.*report|generate.*bug|create.*bug|write.*bug/i,
    response: `## Bug Report

---

**Summary:** Order status does not update in real time — user must hard-refresh to see changes

---

### Classification

| Field | Value |
|---|---|
| **ID** | BUG-2024-1847 |
| **Severity** | High |
| **Priority** | P1 |
| **Status** | Open |
| **Reported by** | QA Automation (CI/CD Pipeline) |
| **Date** | 2024-01-15 |
| **Component** | Order Management / WebSocket |
| **Affects version** | v2.3.8, v2.3.9 |
| **Fixed in** | — |

---

### Environment

\`\`\`
Browser:    Chrome 121.0.6167.85 (macOS 14.2.1)
            Firefox 122.0 (Ubuntu 22.04) — ALSO AFFECTED
OS:         macOS Sonoma 14.2.1
Staging URL: https://staging.acme.com
API Server: v2.3.9 (build #1284)
DB:         PostgreSQL 15.3
Node.js:    20.11.0
\`\`\`

---

### Steps to Reproduce

1. Log in as **admin@acme.com** (password: \`SecurePass#2024\`)
2. Navigate to **Orders → Active Orders**
3. Open a second browser tab — log in as **fulfillment@acme.com**
4. In the second tab, change order **ORD-9821** status from \`Processing\` → \`Shipped\`
5. Switch back to the first tab
6. **Observe:** The status still shows \`Processing\`

---

### Expected Behaviour

The order status in the first tab should update to **Shipped** within **2 seconds** via WebSocket push — no page refresh required.

---

### Actual Behaviour

The order status remains **Processing** indefinitely. Performing a hard refresh (Ctrl+Shift+R) reflects the correct status. The browser console shows:

\`\`\`
WebSocket connection to 'wss://staging.acme.com/ws' failed:
Error during WebSocket handshake: Unexpected response code: 502
    at WebSocket._onerror (websocket.js:187)
\`\`\`

---

### Root Cause (preliminary)

The nginx reverse proxy drops WebSocket connections after **60 seconds** due to a missing \`proxy_read_timeout\` setting. The frontend client does not implement reconnection logic, so once dropped, the socket is never re-established.

---

### Attachments

- 📷 Screenshot — first tab showing stale \`Processing\` status
- 🎥 Screen recording (30s) — demonstrates the issue
- 📄 Network HAR file — WebSocket 502 captured

---

### Suggested Fix

\`\`\`nginx
# nginx/conf.d/app.conf — add to the WebSocket location block
location /ws {
  proxy_pass http://app_backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;   # ← add this
  proxy_send_timeout 3600s;   # ← add this
}
\`\`\`

Also implement client-side reconnection in \`src/lib/websocket.ts\`.

---

**Jira ticket:** [ACME-4291](https://acme.atlassian.net/browse/ACME-4291)`,
  },

  // ── Analyze Logs ──────────────────────────────────────────────────────────
  {
    pattern: /analy[sz].*log|log.*analy|parse.*log|log.*pattern/i,
    response: `## Log Analysis Report

**Source:** \`/var/log/app/production-2024-01-15.log\`  
**Period:** 2024-01-15 08:00 → 16:00 UTC  
**Total log lines:** 284,731

---

### Error Frequency

| Level | Count | % of Total | vs Yesterday |
|---|---|---|---|
| ERROR | 1,847 | 0.65% | ↑ +340% |
| WARN | 4,291 | 1.51% | ↑ +22% |
| INFO | 278,593 | 97.84% | ↔ Normal |

> ⚠️ **Alert:** ERROR rate is 3.4× above baseline — investigate immediately.

---

### Top Error Patterns

**#1 — Database connection timeout (1,203 occurrences)**
\`\`\`
[ERROR] 2024-01-15T14:31:07.123Z | request-id=req_01HX9V | 
  Error: Connection timeout after 8000ms
  at Pool.connect (node_modules/pg/lib/pool.js:181)
  at OrderService.createOrder (src/services/orders.service.ts:94)
\`\`\`
- **First seen:** 14:28:44 UTC
- **Pattern:** Spikes every ~90s, correlates with analytics cron job
- **Affected endpoints:** \`POST /api/v2/orders\`, \`GET /api/v2/orders/:id\`

**#2 — Redis cache miss cascade (389 occurrences)**
\`\`\`
[WARN] 2024-01-15T11:14:22.891Z | Cache miss for key: session:usr_8f72
  Falling back to database lookup. TTL was: 0 (key evicted)
\`\`\`
- **Pattern:** Redis memory at 98.3% — LRU evictions causing DB fallback storms
- **Impact:** +280ms average latency on session validation

**#3 — Unhandled promise rejection (255 occurrences)**
\`\`\`
[ERROR] 2024-01-15T09:47:18.445Z | UnhandledPromiseRejectionWarning:
  TypeError: Cannot read properties of undefined (reading 'userId')
  at NotificationService.send (src/services/notifications.ts:67)
\`\`\`
- **Root cause:** User object is null when sending notifications for deleted accounts
- **Fix:** Add null guard at \`notifications.ts:67\`

---

### Performance Metrics (P50/P95/P99)

| Endpoint | P50 | P95 | P99 | SLA |
|---|---|---|---|---|
| GET /api/v2/orders | 124ms | 891ms | 4,200ms | <1,000ms ⚠️ |
| POST /api/v2/orders | 340ms | 8,421ms | timeout | <2,000ms 🔴 |
| GET /api/v2/projects | 48ms | 210ms | 580ms | <500ms ✅ |
| GET /api/v2/users/me | 22ms | 95ms | 180ms | <200ms ✅ |

---

### Recommendations

1. **🔴 Critical — Fix DB connection pool exhaustion** (see BUG-2024-1849)
2. **🟠 High — Increase Redis memory allocation** from 2GB → 4GB or implement key expiry policy
3. **🟡 Medium — Add null guard** in \`NotificationService.send()\` before accessing \`userId\`
4. **🟢 Low — Enable slow query logging** (>500ms) to surface remaining DB bottlenecks`,
  },

  // ── Generate Playwright script ─────────────────────────────────────────────
  {
    pattern: /playwright|e2e.*script|automation.*script/i,
    response: `## Playwright Automation Script

\`\`\`typescript
// tests/e2e/checkout.spec.ts
import { test, expect, Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ProductPage } from './pages/ProductPage';
import { CheckoutPage } from './pages/CheckoutPage';

test.describe('Checkout Flow — End-to-End', () => {
  let loginPage: LoginPage;
  let productPage: ProductPage;
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    productPage = new ProductPage(page);
    checkoutPage = new CheckoutPage(page);
    await loginPage.goto();
    await loginPage.login('buyer@acme.com', 'BuyerPass#2024');
  });

  test('TC-CHK-001 | Single item purchase — credit card', async ({ page }) => {
    await productPage.goto('SKU-98210');
    await productPage.addToCart();
    await productPage.proceedToCheckout();
    
    await checkoutPage.fillShipping({
      firstName: 'Jane',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    });

    await checkoutPage.fillPayment({
      cardNumber: '4111 1111 1111 1111',
      expiry: '12/26',
      cvv: '123',
      name: 'Jane Doe',
    });

    await checkoutPage.placeOrder();
    
    await expect(page.locator('[data-testid="confirmation-banner"]'))
      .toContainText('Order confirmed');
    await expect(page.locator('[data-testid="order-number"]'))
      .toMatch(/ORD-\d{6}/);
  });

  test('TC-CHK-002 | Promo code applies correct discount', async ({ page }) => {
    await productPage.goto('SKU-98210');
    await productPage.addToCart();
    await checkoutPage.goto();

    const subtotalBefore = await checkoutPage.getSubtotal();
    await checkoutPage.applyPromoCode('SAVE20');

    const discountBadge = page.locator('[data-testid="discount-badge"]');
    await expect(discountBadge).toContainText('20% off');

    const subtotalAfter = await checkoutPage.getSubtotal();
    expect(subtotalAfter).toBeCloseTo(subtotalBefore * 0.8, 2);
  });

  test('TC-CHK-003 | Out-of-stock item cannot be checked out', async ({ page }) => {
    await productPage.goto('SKU-00001-OOS'); // out-of-stock SKU
    const addBtn = page.locator('[data-testid="add-to-cart"]');
    await expect(addBtn).toBeDisabled();
    await expect(page.locator('[data-testid="stock-label"]')).toContainText('Out of stock');
  });
});
\`\`\`

### Page Object Model

\`\`\`typescript
// tests/e2e/pages/CheckoutPage.ts
export class CheckoutPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/checkout');
  }

  async fillShipping(address: ShippingAddress) {
    await this.page.fill('[name="firstName"]', address.firstName);
    await this.page.fill('[name="lastName"]', address.lastName);
    await this.page.fill('[name="address"]', address.address);
    await this.page.fill('[name="city"]', address.city);
    await this.page.selectOption('[name="state"]', address.state);
    await this.page.fill('[name="zip"]', address.zip);
    await this.page.click('[data-testid="shipping-continue"]');
  }

  async getSubtotal(): Promise<number> {
    const text = await this.page
      .locator('[data-testid="subtotal-amount"]')
      .textContent();
    return parseFloat(text!.replace(/[^0-9.]/g, ''));
  }

  async applyPromoCode(code: string) {
    await this.page.fill('[data-testid="promo-input"]', code);
    await this.page.click('[data-testid="apply-promo"]');
    await this.page.waitForResponse(r => r.url().includes('/api/promo') && r.status() === 200);
  }
}
\`\`\``,
  },

  // ── Generate Cypress test ──────────────────────────────────────────────────
  {
    pattern: /cypress/i,
    response: `## Cypress Test Suite

\`\`\`javascript
// cypress/e2e/dashboard.cy.ts
import { faker } from '@faker-js/faker';

describe('Dashboard — Analytics & Navigation', () => {
  beforeEach(() => {
    cy.session('admin', () => {
      cy.visit('/login');
      cy.get('[data-cy=email]').type('admin@acme.com');
      cy.get('[data-cy=password]').type('SecurePass#2024');
      cy.get('[data-cy=login-btn]').click();
      cy.url().should('include', '/dashboard');
    });
    cy.visit('/dashboard');
  });

  context('KPI Cards', () => {
    it('displays all four metric cards with positive values', () => {
      cy.get('[data-cy=kpi-card]').should('have.length', 4);
      cy.get('[data-cy=total-projects]').invoke('text').then(parseInt).should('be.gt', 0);
      cy.get('[data-cy=active-audits]').invoke('text').then(parseInt).should('be.gte', 0);
      cy.get('[data-cy=open-bugs]').invoke('text').then(parseInt).should('be.gte', 0);
      cy.get('[data-cy=avg-score]').invoke('text').then(parseFloat).should('be.within', 0, 100);
    });
  });

  context('Audit Trends Chart', () => {
    it('renders a line chart with at least 7 data points', () => {
      cy.get('[data-cy=audit-trends-chart]').should('be.visible');
      cy.get('[data-cy=audit-trends-chart] .recharts-line-dot').should('have.length.gte', 7);
    });

    it('shows tooltip on hover', () => {
      cy.get('[data-cy=audit-trends-chart]').trigger('mousemove', { clientX: 300, clientY: 150 });
      cy.get('.recharts-tooltip-wrapper').should('be.visible');
    });
  });

  context('Recent Activity Feed', () => {
    it('lists at least 5 recent activities', () => {
      cy.get('[data-cy=activity-item]').should('have.length.gte', 5);
    });

    it('each activity has a timestamp and description', () => {
      cy.get('[data-cy=activity-item]').first().within(() => {
        cy.get('[data-cy=activity-time]').should('not.be.empty');
        cy.get('[data-cy=activity-desc]').should('not.be.empty');
      });
    });
  });

  context('Quick Actions', () => {
    it('New Project button navigates to /projects/new', () => {
      cy.get('[data-cy=quick-action-new-project]').click();
      cy.url().should('include', '/projects/new');
    });
  });
});
\`\`\``,
  },

  // ── Generate Postman Collection ────────────────────────────────────────────
  {
    pattern: /postman|collection.*api|api.*collection/i,
    response: `## Postman Collection — Orders API v2

\`\`\`json
{
  "info": {
    "name": "ACME Orders API v2",
    "description": "Complete test suite for the Orders service",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "version": "2.4.0"
  },
  "auth": {
    "type": "bearer",
    "bearer": [{ "key": "token", "value": "{{access_token}}" }]
  },
  "variable": [
    { "key": "base_url", "value": "https://staging.acme.com/api/v2" },
    { "key": "access_token", "value": "" },
    { "key": "order_id", "value": "" }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "POST Login",
          "event": [{
            "listen": "test",
            "script": {
              "exec": [
                "pm.test('Status is 200', () => pm.response.to.have.status(200));",
                "pm.test('Returns access token', () => {",
                "  const body = pm.response.json();",
                "  pm.expect(body.token).to.be.a('string');",
                "  pm.collectionVariables.set('access_token', body.token);",
                "});"
              ]
            }
          }],
          "request": {
            "method": "POST",
            "url": "{{base_url}}/auth/login",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{ \\"email\\": \\"admin@acme.com\\", \\"password\\": \\"SecurePass#2024\\" }"
            }
          }
        }
      ]
    },
    {
      "name": "Orders",
      "item": [
        {
          "name": "GET List Orders",
          "event": [{
            "listen": "test",
            "script": {
              "exec": [
                "pm.test('Status is 200', () => pm.response.to.have.status(200));",
                "pm.test('Returns array', () => {",
                "  const body = pm.response.json();",
                "  pm.expect(body.data).to.be.an('array');",
                "  pm.expect(body.pagination).to.have.property('total');",
                "});"
              ]
            }
          }],
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{base_url}}/orders?page=1&limit=20&status=pending",
              "query": [
                { "key": "page", "value": "1" },
                { "key": "limit", "value": "20" },
                { "key": "status", "value": "pending" }
              ]
            }
          }
        },
        {
          "name": "POST Create Order",
          "event": [{
            "listen": "test",
            "script": {
              "exec": [
                "pm.test('Status is 201', () => pm.response.to.have.status(201));",
                "pm.test('Order has ID', () => {",
                "  const { data } = pm.response.json();",
                "  pm.expect(data.id).to.match(/^ORD-\\\\d{6}$/);",
                "  pm.collectionVariables.set('order_id', data.id);",
                "});"
              ]
            }
          }],
          "request": {
            "method": "POST",
            "url": "{{base_url}}/orders",
            "body": {
              "mode": "raw",
              "raw": "{ \\"customerId\\": \\"cust_8f72abc\\", \\"items\\": [{ \\"sku\\": \\"SKU-98210\\", \\"qty\\": 2 }] }"
            }
          }
        }
      ]
    }
  ]
}
\`\`\`

Save this as \`acme-orders-api.postman_collection.json\` and import via **File → Import** in Postman.`,
  },

  // ── Generate SQL Queries ──────────────────────────────────────────────────
  {
    pattern: /sql.*quer|quer.*sql|database.*quer|generate.*sql/i,
    response: `## SQL Queries — QA Analytics

### 1. Bug Density by Project (last 30 days)

\`\`\`sql
SELECT
  p.name                                    AS project_name,
  COUNT(DISTINCT ar.id)                     AS audit_count,
  COUNT(b.id)                               AS total_bugs,
  COUNT(b.id) FILTER (WHERE b.severity = 'critical') AS critical_bugs,
  ROUND(COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT ar.id), 0), 1) AS bugs_per_audit,
  ROUND(AVG(ar.overall_score), 1)           AS avg_score
FROM projects p
LEFT JOIN audit_runs ar ON ar.project_id = p.id
  AND ar.created_at >= NOW() - INTERVAL '30 days'
  AND ar.status = 'completed'
LEFT JOIN bugs b ON b.audit_run_id = ar.id
  AND b.status != 'ignored'
GROUP BY p.id, p.name
ORDER BY critical_bugs DESC, total_bugs DESC;
\`\`\`

### 2. Test Failure Rate Trend (weekly)

\`\`\`sql
SELECT
  DATE_TRUNC('week', created_at)            AS week_start,
  COUNT(*)                                  AS total_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2
  )                                         AS failure_rate_pct,
  ROUND(AVG(overall_score), 1)              AS avg_score
FROM audit_runs
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY 1
ORDER BY 1 DESC;
\`\`\`

### 3. Mean Time to Resolution (MTTR) by Severity

\`\`\`sql
SELECT
  severity,
  COUNT(*)                                        AS total_bugs,
  COUNT(*) FILTER (WHERE status = 'resolved')     AS resolved,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
    ) FILTER (WHERE status = 'resolved'), 1
  )                                               AS avg_hours_to_resolve,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
  ) FILTER (WHERE status = 'resolved')            AS median_hours_to_resolve
FROM bugs
WHERE status = 'resolved'
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY severity
ORDER BY CASE severity
  WHEN 'critical' THEN 1 WHEN 'high' THEN 2
  WHEN 'medium'   THEN 3 WHEN 'low'  THEN 4
END;
\`\`\`

### 4. Top 10 Slowest API Endpoints

\`\`\`sql
SELECT
  endpoint,
  COUNT(*)                                  AS request_count,
  ROUND(AVG(response_time_ms))              AS avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)) AS p95_ms,
  MAX(response_time_ms)                     AS max_ms,
  COUNT(*) FILTER (WHERE status_code >= 500) AS error_count
FROM api_request_logs
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY p95_ms DESC
LIMIT 10;
\`\`\``,
  },

  // ── Generate Release Notes ────────────────────────────────────────────────
  {
    pattern: /release.*note|changelog|what.*changed|version.*note/i,
    response: `## Release Notes — v2.4.0

**Release date:** January 18, 2024  
**Type:** Minor release  
**Deployed by:** CI/CD Pipeline · Build #1294

---

### ✨ New Features

**AI QA Copilot (Beta)**
- Integrated AI assistant across the QA Portal for test generation, log analysis, and root cause analysis
- Context-aware prompts for 18 QA capability areas
- Conversation history persisted per session
- Supports Playwright, Cypress, Selenium, and Postman output formats

**Real-time Order Status Updates**
- WebSocket push notifications for order status changes — no more manual refresh required
- Reconnection logic with exponential backoff (fixes BUG-2024-1847)
- Optimistic UI updates reduce perceived latency by ~400ms

**Bulk Audit Scheduling**
- Schedule up to 50 audits at once using CSV import
- Cron syntax support: \`0 2 * * *\` (runs daily at 2 AM)
- Email digest of scheduled audit results

---

### 🛠 Improvements

| Area | Change |
|---|---|
| DB Connection Pool | Increased from 10 → 25 connections; added pg_bouncer |
| Auth | JWT expiry extended from 1h → 8h; refresh token introduced |
| PDF Reports | Upgraded from plain-text to formatted PDF via pdfkit |
| Dashboard | P95 load time improved from 2,800ms → 680ms |
| Notifications | Batch processing reduces email send latency by 60% |

---

### 🐛 Bug Fixes

- **BUG-2024-1847** — Order status stale in real time (WebSocket 502)
- **BUG-2024-1821** — Pagination breaks when navigating to last page with <limit items
- **BUG-2024-1809** — PDF export corrupted for reports with non-ASCII characters
- **BUG-2024-1798** — Admin users could not delete projects created by other admins
- **BUG-2024-1783** — Notification count badge not resetting after "Mark all read"

---

### ⚠️ Breaking Changes

\`\`\`
POST /api/v1/auth/login  →  DEPRECATED (removed in v2.5.0)
POST /api/v2/auth/login  →  Now returns { token, refreshToken, expiresAt }
\`\`\`

Clients must update to handle the \`refreshToken\` field. See the [migration guide](https://docs.acme.com/v2.4-migration).

---

### 📦 Dependency Updates

| Package | From | To | Notes |
|---|---|---|---|
| Node.js | 20.9 | 20.11 | Security patch |
| PostgreSQL | 15.2 | 15.3 | Bug fixes |
| Playwright | 1.40 | 1.41 | New \`page.clock\` API |
| pdfkit | — | 0.14.0 | New dependency |`,
  },

  // ── Generate Smoke Test Suite ─────────────────────────────────────────────
  {
    pattern: /smoke.*test|smoke.*suite/i,
    response: `## Smoke Test Suite — Production Verification

**Purpose:** Fast (< 5 min) go/no-go check after every production deployment.  
**Run command:** \`npx playwright test tests/smoke/ --workers=4 --reporter=dot\`

---

\`\`\`typescript
// tests/smoke/production.smoke.ts
import { test, expect } from '@playwright/test';

const PROD = 'https://app.acme.com';

test.describe('🚦 Smoke Suite — Production', () => {

  test('S01 | Health endpoint is alive', async ({ request }) => {
    const res = await request.get(\`\${PROD}/api/healthz\`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  test('S02 | Login page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(\`\${PROD}/login\`);
    await expect(page.locator('[data-testid="login-btn"]')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('S03 | Authentication works', async ({ page }) => {
    await page.goto(\`\${PROD}/login\`);
    await page.fill('[data-testid="email"]', process.env.SMOKE_USER!);
    await page.fill('[data-testid="password"]', process.env.SMOKE_PASS!);
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 8000 });
  });

  test('S04 | Dashboard loads within SLA (3 seconds)', async ({ page }) => {
    const start = Date.now();
    await page.goto(\`\${PROD}/dashboard\`);
    await page.waitForSelector('[data-testid="kpi-card"]');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });

  test('S05 | Projects list returns data', async ({ request }) => {
    const res = await request.get(\`\${PROD}/api/v2/projects?limit=5\`, {
      headers: { Authorization: \`Bearer \${process.env.SMOKE_TOKEN}\` }
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('S06 | Static assets served with correct cache headers', async ({ request }) => {
    const res = await request.get(\`\${PROD}/\`);
    const cc = res.headers()['cache-control'];
    expect(cc).toMatch(/max-age|no-cache/);
  });

  test('S07 | CDN responds for main JS bundle', async ({ page }) => {
    const responses: number[] = [];
    page.on('response', r => {
      if (r.url().includes('/assets/') && r.url().endsWith('.js'))
        responses.push(r.status());
    });
    await page.goto(\`\${PROD}/dashboard\`);
    expect(responses.every(s => s === 200 || s === 304)).toBe(true);
  });
});
\`\`\`

### CI Integration

\`\`\`yaml
# .github/workflows/smoke.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  smoke:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: npx playwright install chromium
      - run: npx playwright test tests/smoke/
        env:
          SMOKE_USER: \${{ secrets.SMOKE_USER }}
          SMOKE_PASS:  \${{ secrets.SMOKE_PASS }}
          SMOKE_TOKEN: \${{ secrets.SMOKE_TOKEN }}
\`\`\``,
  },

  // ── Suggest Edge Cases ────────────────────────────────────────────────────
  {
    pattern: /edge.*case|suggest.*case|boundary|corner.*case/i,
    response: `## Edge Case Analysis — User Registration & Profile

Here are 24 edge cases to cover, organised by risk:

### 🔴 High Risk — Must Test

| # | Input / Scenario | Expected Behaviour | Notes |
|---|---|---|---|
| E01 | Email with "+" alias: \`user+tag@gmail.com\` | Accepted, stored as-is | Many forms strip this incorrectly |
| E02 | Password exactly at min length (8 chars) | Accepted | Off-by-one boundary |
| E03 | Password exactly at max length (128 chars) | Accepted | Check for DB truncation |
| E04 | Password at 129 chars | Rejected with clear error | |
| E05 | Duplicate email (existing account) | "Email already in use" error | Must not expose account existence to unauthenticated users |
| E06 | SQL injection in name field: \`'; DROP TABLE users;--\` | Sanitised, stored as literal string | |
| E07 | XSS in display name: \`<script>alert(1)</script>\` | Escaped in all UI renders | |
| E08 | Unicode name: \`José García\` | Stored and displayed correctly | Check DB charset is utf8mb4 |

### 🟠 Medium Risk — Should Test

| # | Input / Scenario | Expected Behaviour |
|---|---|---|
| E09 | Email with international domain: \`user@münchen.de\` | Accepted (IDN support) |
| E10 | Whitespace-only name: \`"   "\` | Rejected — "Name is required" |
| E11 | Very long display name (256 chars) | Rejected with char limit error |
| E12 | Concurrent registration with same email (race) | Only one account created |
| E13 | Registration during DB maintenance window | Friendly error, no stack trace |
| E14 | Profile photo > 5 MB | Rejected — "File too large" |
| E15 | Profile photo with executable extension renamed to .jpg | Rejected — MIME type check |
| E16 | Timezone set to UTC+14 (Kiribati) | Timestamps display correctly |

### 🟡 Low Risk — Nice to Have

| # | Input / Scenario | Expected Behaviour |
|---|---|---|
| E17 | Name with emoji: \`Alex 🚀\` | Stored and displayed (or rejected with clear error) |
| E18 | Email with 254 chars (RFC max) | Accepted |
| E19 | Email with 255 chars (over RFC max) | Rejected |
| E20 | Multiple rapid profile updates (debounce) | Last write wins, no duplicate requests |
| E21 | Account deletion then re-register with same email | Clean re-registration allowed after TTL |
| E22 | Two-factor setup with phone number that includes country code \`+1\` | Normalised and accepted |
| E23 | Copying profile data from a right-to-left language (Arabic, Hebrew) | Text direction preserved in textarea |
| E24 | Session token used after account deletion | 401 Unauthorized — token invalidated |`,
  },

  // ── Explain Stack Trace ────────────────────────────────────────────────────
  {
    pattern: /stack.*trace|traceback|exception.*trace|explain.*error.*trace/i,
    response: `## Stack Trace Analysis

### Input

\`\`\`
TypeError: Cannot read properties of undefined (reading 'map')
    at ProjectList.render (src/components/ProjectList.tsx:47:28)
    at processChild (node_modules/react-dom/cjs/react-dom.development.js:3990:14)
    at resolve (node_modules/react-dom/cjs/react-dom.development.js:4056:5)
    at ReactDOMServerRenderer.read (node_modules/react-dom/cjs/react-dom.development.js:3690:11)
    at Object.renderToString (node_modules/react-dom/cjs/react-dom.development.js:4297:27)
\`\`\`

### Root Cause

**The error** occurs at \`ProjectList.tsx:47\` where \`.map()\` is called on a value that is \`undefined\`.

**Why it's undefined:** The component is rendering before the API response arrives. The \`projects\` prop (or state) is initialized as \`undefined\` (rather than \`[]\`), so calling \`.map()\` on it throws immediately.

---

### Offending Code (likely)

\`\`\`typescript
// ❌ src/components/ProjectList.tsx:44-50
function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ul>
      {projects.map(p => (  // line 47 — crashes if projects is undefined
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
\`\`\`

---

### Fixes

**Option 1 — Default prop / fallback (quickest)**

\`\`\`typescript
// ✅ Provide a safe default
function ProjectList({ projects = [] }: { projects?: Project[] }) {
  return (
    <ul>
      {projects.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
\`\`\`

**Option 2 — Guard at the call site (most explicit)**

\`\`\`typescript
// ✅ In the parent, guard before rendering
{isLoading ? (
  <Skeleton />
) : projects ? (
  <ProjectList projects={projects} />
) : (
  <EmptyState message="No projects found." />
)}
\`\`\`

**Option 3 — TypeScript strict null checks (preventative)**

Add to \`tsconfig.json\`:
\`\`\`json
{ "compilerOptions": { "strictNullChecks": true } }
\`\`\`

This would have caught the \`undefined\` assignment at compile time before it reached production.

---

### Prevention Checklist

- [ ] Always initialise list state as \`[]\`, never \`undefined\`
- [ ] Add \`strictNullChecks: true\` to tsconfig
- [ ] Use React Query's \`data ?? []\` pattern for API-driven lists
- [ ] Add an error boundary above \`ProjectList\` to prevent full-page crash`,
  },

  // ── Generate Jira Ticket ───────────────────────────────────────────────────
  {
    pattern: /jira|ticket.*description|issue.*description|create.*ticket/i,
    response: `## Jira Ticket — Ready to Paste

---

**Summary:** \`[BUG] Order status not updated in real time — WebSocket connection drops after 60s\`

---

### Description

**Problem**

When a user has the Order Management page open, order status changes made by other users (or system automations) are not reflected in their browser. The page displays stale data until a hard refresh is performed.

**Business impact:** Customer support agents are incorrectly telling customers their orders are still "Processing" when they have already been "Shipped." Estimated 15–20 escalation tickets per day are caused by this.

---

**Steps to Reproduce**

1. Log in as \`fulfillment@acme.com\` → open **Orders → Active Orders**
2. In a second session (different browser/incognito), log in as \`admin@acme.com\`
3. Update order **ORD-9821** status: \`Processing\` → \`Shipped\`
4. Switch back to the first session
5. **Result:** Status shows \`Processing\`; expected \`Shipped\`

---

**Root Cause**

The nginx proxy drops WebSocket connections at 60 seconds (\`proxy_read_timeout\` defaults to 60s). The frontend client does not attempt reconnection. Network tab shows:

\`\`\`
WebSocket: wss://app.acme.com/ws → CLOSED (code 1006, abnormal closure at ~60.3s)
\`\`\`

---

**Proposed Solution**

1. Set \`proxy_read_timeout 3600s\` in nginx WebSocket location block
2. Implement client-side exponential-backoff reconnection in \`src/lib/websocket-client.ts\`
3. Add a "Reconnecting…" banner to the UI when connection is lost

**Acceptance Criteria**

- [ ] WebSocket connection remains open for ≥ 60 minutes of inactivity
- [ ] If connection drops, client reconnects within 10 seconds without user action
- [ ] Order status updates appear within 2 seconds of the change
- [ ] A "Live" / "Reconnecting" indicator is visible in the UI

---

| Field | Value |
|---|---|
| **Type** | Bug |
| **Priority** | P1 — High |
| **Severity** | High |
| **Components** | Order Management, WebSocket, Infrastructure |
| **Labels** | real-time, websocket, nginx, dx-regression |
| **Sprint** | Sprint 41 |
| **Story Points** | 5 |
| **Affected versions** | v2.3.8, v2.3.9 |
| **Fix version** | v2.4.0 |`,
  },

  // ── Generate API Documentation ─────────────────────────────────────────────
  {
    pattern: /api.*doc|document.*api|openapi|swagger/i,
    response: `## API Documentation — Orders Service

### Base URL
\`https://api.acme.com/v2\`

All requests require \`Authorization: Bearer <token>\`.

---

### \`GET /orders\`

Retrieve a paginated list of orders with optional filtering.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`page\` | integer | 1 | Page number (1-indexed) |
| \`limit\` | integer | 20 | Items per page (max: 100) |
| \`status\` | string | — | Filter by status: \`pending\`, \`processing\`, \`shipped\`, \`cancelled\` |
| \`customerId\` | string | — | Filter by customer ID |
| \`from\` | ISO 8601 | — | Created after this datetime |
| \`to\` | ISO 8601 | — | Created before this datetime |

**Response \`200 OK\`**

\`\`\`json
{
  "data": [
    {
      "id": "ORD-982104",
      "customerId": "cust_8f72abc",
      "status": "shipped",
      "total": 149.99,
      "currency": "USD",
      "items": [
        { "sku": "SKU-98210", "name": "Wireless Headphones Pro", "qty": 1, "unitPrice": 149.99 }
      ],
      "shippingAddress": {
        "line1": "123 Main St", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"
      },
      "createdAt": "2024-01-15T10:22:07Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1, "limit": 20, "total": 847, "pages": 43
  }
}
\`\`\`

---

### \`POST /orders\`

Create a new order.

**Request body**

\`\`\`json
{
  "customerId": "cust_8f72abc",
  "items": [
    { "sku": "SKU-98210", "qty": 2 }
  ],
  "promoCode": "SAVE20",
  "shippingMethod": "standard"
}
\`\`\`

**Response \`201 Created\`** — returns the full order object (see above).

**Error responses**

| Code | Error | Description |
|---|---|---|
| \`400\` | \`VALIDATION_ERROR\` | Missing or invalid fields |
| \`404\` | \`CUSTOMER_NOT_FOUND\` | \`customerId\` does not exist |
| \`409\` | \`SKU_OUT_OF_STOCK\` | One or more SKUs unavailable |
| \`422\` | \`INVALID_PROMO_CODE\` | Promo code expired or invalid |
| \`500\` | \`INTERNAL_SERVER_ERROR\` | Unexpected server error |

---

### \`PATCH /orders/:id/status\`

Update an order's status. Follows a strict state machine:

\`\`\`
pending → processing → shipped → delivered
       ↘ cancelled  (any state before shipped)
\`\`\`

\`\`\`json
// Request
{ "status": "shipped", "trackingNumber": "1Z999AA10123456784" }

// Response 200
{ "id": "ORD-982104", "status": "shipped", "updatedAt": "2024-01-15T16:00:00Z" }
\`\`\`

**Rate limits:** 1,000 requests / minute per API token.`,
  },

  // ── Generate Test Data ─────────────────────────────────────────────────────
  {
    pattern: /test.*data|data.*generate|seed.*data|mock.*data|fake.*data/i,
    response: `## Test Data — E-commerce Platform

### Users

\`\`\`json
[
  {
    "id": "usr_admin_001",
    "email": "admin@acme.com",
    "name": "Alex Chen",
    "role": "admin",
    "password": "SecurePass#2024",
    "createdAt": "2023-06-01T00:00:00Z"
  },
  {
    "id": "usr_buyer_001",
    "email": "sarah.williams@example.com",
    "name": "Sarah Williams",
    "role": "buyer",
    "password": "BuyerPass#2024",
    "phone": "+1-512-555-0142",
    "address": { "line1": "456 Oak Ave", "city": "Austin", "state": "TX", "zip": "78702" }
  },
  {
    "id": "usr_buyer_002",
    "email": "marcus.johnson@example.com",
    "name": "Marcus Johnson",
    "role": "buyer",
    "password": "BuyerPass#2024",
    "phone": "+1-415-555-0198"
  }
]
\`\`\`

### Products

\`\`\`json
[
  { "sku": "SKU-98210", "name": "Wireless Headphones Pro", "price": 149.99, "stock": 342, "category": "Electronics" },
  { "sku": "SKU-00001-OOS", "name": "Gaming Mouse Ultra", "price": 79.99, "stock": 0, "category": "Electronics" },
  { "sku": "SKU-44820", "name": "Standing Desk Converter", "price": 289.00, "stock": 18, "category": "Furniture" },
  { "sku": "SKU-71100", "name": "Mechanical Keyboard TKL", "price": 119.99, "stock": 95, "category": "Electronics" }
]
\`\`\`

### Orders (covering key test scenarios)

\`\`\`json
[
  { "id": "ORD-000001", "customerId": "usr_buyer_001", "status": "delivered", "total": 299.98, "note": "Happy path — completed" },
  { "id": "ORD-000002", "customerId": "usr_buyer_001", "status": "processing", "total": 149.99, "note": "In-progress order" },
  { "id": "ORD-000003", "customerId": "usr_buyer_002", "status": "pending",    "total": 119.99, "note": "Awaiting payment confirmation" },
  { "id": "ORD-000004", "customerId": "usr_buyer_001", "status": "cancelled",  "total": 79.99,  "note": "Cancelled by customer" },
  { "id": "ORD-000005", "customerId": "usr_buyer_002", "status": "shipped",    "total": 289.00, "note": "Awaiting delivery" }
]
\`\`\`

### Promo Codes

\`\`\`json
[
  { "code": "SAVE20",     "type": "percentage", "value": 20, "minOrder": 50, "expires": "2025-12-31", "active": true },
  { "code": "FLAT10",     "type": "fixed",       "value": 10, "minOrder": 30, "expires": "2025-06-30", "active": true },
  { "code": "EXPIRED123", "type": "percentage", "value": 15, "minOrder": 0,  "expires": "2023-01-01", "active": false },
  { "code": "MAXED_OUT",  "type": "percentage", "value": 25, "minOrder": 0,  "usageLimit": 1, "usageCount": 1, "active": false }
]
\`\`\`

### Seed Script

\`\`\`typescript
// scripts/seed-test-data.ts
import { db } from '../lib/db';
import { users, products, orders, promoCodes } from './test-fixtures';

async function seed() {
  console.log('Seeding test data...');
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values(users).onConflictDoNothing();
    await tx.insert(schema.products).values(products).onConflictDoNothing();
    await tx.insert(schema.orders).values(orders).onConflictDoNothing();
    await tx.insert(schema.promoCodes).values(promoCodes).onConflictDoNothing();
  });
  console.log('✓ Done');
}
seed().catch(console.error);
\`\`\``,
  },

  // ── Sprint Summary ─────────────────────────────────────────────────────────
  {
    pattern: /sprint.*progress|sprint.*summar|sprint.*status|team.*progress/i,
    response: `## Sprint 41 Progress Summary

**Sprint:** 41 (Jan 8 – Jan 22, 2024)  
**Team:** QA Platform — 6 engineers  
**Generated:** January 15, 2024 · Day 6 of 10

---

### Velocity & Completion

| Metric | Value |
|---|---|
| Committed points | 52 |
| Completed points | 31 (60%) |
| In-progress | 14 points |
| Not started | 7 points |
| Carry-over risk | 🟠 Medium |

---

### Story Status

| Story | Points | Status | Assigned | Notes |
|---|---|---|---|---|
| ACME-4201 — WebSocket reconnection | 5 | ✅ Done | Marcus J. | Merged, in staging |
| ACME-4202 — Bulk audit scheduler | 8 | ✅ Done | Sarah C. | QA approved |
| ACME-4203 — AI Copilot — Phase 1 | 13 | 🔵 In Review | Alex P. | PR open, 2 review cycles |
| ACME-4204 — PDF report upgrade | 5 | 🔵 In Progress | Priya K. | ~70% complete |
| ACME-4205 — DB connection pool fix | 3 | ✅ Done | DevOps | Deployed to prod |
| ACME-4206 — Role permission overhaul | 8 | 🔵 In Progress | Marcus J. | Backend done, FE pending |
| ACME-4207 — Notification digest email | 5 | 🔴 Blocked | Sarah C. | Awaiting SendGrid API key |
| ACME-4208 — Mobile responsive audit page | 5 | ⬜ Not started | — | Deprioritised |

---

### Bug Queue

| ID | Severity | Status | Age |
|---|---|---|---|
| BUG-2024-1847 | High | ✅ Fixed | 3 days |
| BUG-2024-1821 | Medium | 🔵 In Progress | 5 days |
| BUG-2024-1809 | Medium | ✅ Fixed | 8 days |
| BUG-2024-1856 | Low | ⬜ Backlog | 1 day |

---

### Blockers & Risks

🔴 **ACME-4207 blocked** — SendGrid API key not provisioned. @devops-team action needed by EOD Jan 15.

🟠 **ACME-4203 review delay** — PR has been in review for 2 cycles with no final approval. Recommend pairing review session with Alex & Marcus tomorrow AM.

🟡 **Sprint carry-over risk** — At current velocity (31pts / 6 days), projected completion is 52pts by Day 9. Achievable if blockers resolve today.

---

### Recommendations

1. **Unblock ACME-4207** — Escalate SendGrid provisioning to eng-ops Slack channel
2. **Pair review** on AI Copilot PR to get it merged before Day 7
3. **Drop ACME-4208** from sprint scope — move to Sprint 42 backlog`,
  },

  // ── Root Cause Analysis ────────────────────────────────────────────────────
  {
    pattern: /root.*cause|rca|incident.*analy|post.*mortem/i,
    response: `## Root Cause Analysis — Production Incident #P1-2024-0115

**Incident:** API 500 errors spike — Order creation failing (34% error rate)  
**Duration:** 2024-01-15 14:28 → 15:11 UTC (43 minutes)  
**Severity:** P1  
**Impact:** ~1,200 users affected, ~$18,400 estimated revenue loss  

---

### Timeline

| Time (UTC) | Event |
|---|---|
| 14:00 | Analytics cron job starts (runs every 6h) — opens 6 DB connections |
| 14:20 | Order traffic peaks — pool at 9/10 connections |
| 14:28 | **Pool exhausted** — new requests begin queuing |
| 14:31 | First \`Connection timeout\` errors appear in logs |
| 14:33 | PagerDuty fires — on-call engineer notified |
| 14:48 | Engineer identifies analytics job as root cause |
| 14:51 | Analytics job manually terminated |
| 14:53 | Pool drains — error rate drops to 0% |
| 15:11 | Full recovery confirmed, incident closed |

---

### Five Whys

1. **Why did orders fail?** → DB connection pool was exhausted
2. **Why was the pool exhausted?** → Analytics job held 6 of 10 connections for >40 minutes
3. **Why did it hold so many for so long?** → Analytics query lacks an index on \`orders.created_at\` — full table scan takes 40–60 min
4. **Why does the app share one pool with analytics?** → No separate read replica configured; analytics runs on the primary DB
5. **Why wasn't this detected before?** → No pool utilisation alerting; load tests never included concurrent analytics + peak traffic

---

### Contributing Factors

- ❌ Connection pool size (10) too small for peak + background workload
- ❌ No circuit breaker — failed fast would have reduced user impact
- ❌ No pool utilisation alert (alert configured at 80% — never triggered; should be 70%)
- ❌ Analytics uses primary DB instead of read replica
- ❌ Missing index on \`orders.created_at\` caused 40-min query

---

### Corrective Actions

| Action | Owner | Due | Status |
|---|---|---|---|
| Increase pool size to 25 | DevOps | Jan 15 | ✅ Done |
| Add \`created_at\` index to orders | Backend | Jan 16 | 🔵 In Progress |
| Create read replica for analytics | DevOps | Jan 19 | ⬜ Planned |
| Add circuit breaker to DB layer | Backend | Jan 22 | ⬜ Planned |
| Add pool utilisation alert at 70% | DevOps | Jan 17 | ⬜ Planned |
| Add analytics to separate DB user with connection limit 3 | DBA | Jan 18 | ⬜ Planned |

---

### Prevention

This class of incident is preventable with **connection pool monitoring** and **workload isolation**. We will adopt these standards going forward:

- All background jobs run against the read replica
- Connection pool alerts fire at 70% utilisation
- Circuit breakers on all external I/O (DB, Redis, third-party APIs)`,
  },

  // ── Selenium ──────────────────────────────────────────────────────────────
  {
    pattern: /selenium/i,
    response: `## Selenium WebDriver Test — Java (JUnit 5)

\`\`\`java
// src/test/java/com/acme/tests/LoginTest.java
package com.acme.tests;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.*;

import java.time.Duration;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LoginTest {

  private WebDriver driver;
  private WebDriverWait wait;
  private static final String BASE_URL = System.getenv().getOrDefault(
      "APP_URL", "https://staging.acme.com"
  );

  @BeforeAll
  void setUp() {
    WebDriverManager.chromedriver().setup();
    ChromeOptions opts = new ChromeOptions();
    opts.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage");
    driver = new ChromeDriver(opts);
    driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(5));
    wait = new WebDriverWait(driver, Duration.ofSeconds(10));
  }

  @AfterAll
  void tearDown() {
    if (driver != null) driver.quit();
  }

  @Test
  @DisplayName("TC-AUTH-001 | Happy path — valid credentials redirect to dashboard")
  void testSuccessfulLogin() {
    driver.get(BASE_URL + "/login");

    driver.findElement(By.cssSelector("[data-testid='email']"))
          .sendKeys("admin@acme.com");
    driver.findElement(By.cssSelector("[data-testid='password']"))
          .sendKeys("SecurePass#2024");
    driver.findElement(By.cssSelector("[data-testid='login-btn']")).click();

    wait.until(ExpectedConditions.urlContains("/dashboard"));
    Assertions.assertTrue(driver.getCurrentUrl().contains("/dashboard"),
        "Should redirect to dashboard after successful login");
  }

  @Test
  @DisplayName("TC-AUTH-002 | Invalid credentials show error message")
  void testInvalidCredentials() {
    driver.get(BASE_URL + "/login");

    driver.findElement(By.cssSelector("[data-testid='email']"))
          .sendKeys("admin@acme.com");
    driver.findElement(By.cssSelector("[data-testid='password']"))
          .sendKeys("wrongpassword123");
    driver.findElement(By.cssSelector("[data-testid='login-btn']")).click();

    WebElement error = wait.until(ExpectedConditions.visibilityOfElementLocated(
        By.cssSelector("[data-testid='error-toast']")
    ));
    Assertions.assertTrue(error.getText().contains("Invalid email or password"),
        "Should show invalid credentials error");
  }

  @Test
  @DisplayName("TC-AUTH-003 | Empty form shows validation errors")
  void testEmptyFormValidation() {
    driver.get(BASE_URL + "/login");
    driver.findElement(By.cssSelector("[data-testid='login-btn']")).click();

    Assertions.assertTrue(
        driver.findElement(By.xpath("//p[contains(text(),'Email is required')]")).isDisplayed()
    );
  }
}
\`\`\`

### Maven Dependencies (\`pom.xml\`)

\`\`\`xml
<dependencies>
  <dependency>
    <groupId>org.seleniumhq.selenium</groupId>
    <artifactId>selenium-java</artifactId>
    <version>4.17.0</version>
  </dependency>
  <dependency>
    <groupId>io.github.bonigarcia</groupId>
    <artifactId>webdrivermanager</artifactId>
    <version>5.7.0</version>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.1</version>
    <scope>test</scope>
  </dependency>
</dependencies>
\`\`\``,
  },
];

const FALLBACK_RESPONSES = [
  `I can help with a wide range of QA and engineering tasks. Here are some things I'm great at:

| Capability | Example prompt |
|---|---|
| Test generation | "Generate Playwright tests for the checkout flow" |
| Bug reports | "Write a bug report for a login timeout issue" |
| Log analysis | "Analyze these server logs for error patterns" |
| API docs | "Generate API documentation for the Orders endpoint" |
| SQL queries | "Write SQL to find the top 10 slowest API endpoints" |
| Release notes | "Generate release notes for v2.4.0" |
| Root cause analysis | "Run RCA on a 500 error spike" |
| Sprint summaries | "Summarize sprint 41 progress" |
| Edge cases | "Suggest edge cases for user registration" |
| Stack traces | "Explain this Node.js stack trace" |

Try one of the quick prompts or describe your specific scenario — the more context you give me, the more precise my output will be.`,

  `That's a great question. To give you the most accurate output, could you provide a bit more context?

For example:
- **For test generation:** Which page or user flow are you testing? What framework — Playwright, Cypress, or Selenium?
- **For log analysis:** Paste a sample of the logs you want me to inspect.
- **For API analysis:** Share the endpoint, status code, and request/response if possible.
- **For SQL:** What's the database schema and what question are you trying to answer?

In the meantime, here's what I can do right now with any of the quick prompt cards below.`,
];

function getMockResponse(message: string): string {
  const matched = RESPONSES.find(r => r.pattern.test(message));
  if (matched) return matched.response;
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(sessions: Session[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Session[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  sessions.forEach(s => {
    const d = new Date(s.updatedAt);
    if (d.toDateString() === today.toDateString()) groups[0].items.push(s);
    else if (d.toDateString() === yesterday.toDateString()) groups[1].items.push(s);
    else if (d >= weekAgo) groups[2].items.push(s);
    else groups[3].items.push(s);
  });

  return groups.filter(g => g.items.length > 0);
}

// ─── Persist sessions to localStorage ────────────────────────────────────────

const STORAGE_KEY = "qa-copilot-sessions";

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: Session) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function MarkdownContent({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = !!match;
          if (isBlock) {
            return (
              <SyntaxHighlighter
                style={isDark ? oneDark : oneLight}
                language={match[1]}
                PreTag="div"
                className="!rounded-lg !text-xs !my-3"
                {...(props as any)}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          }
          return (
            <code
              className="bg-muted text-primary px-1.5 py-0.5 rounded text-[0.8em] font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted/60">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border border-border px-3 py-2 text-left text-xs font-semibold text-foreground">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-border px-3 py-2 text-xs text-foreground/90">
              {children}
            </td>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3">
              {children}
            </blockquote>
          );
        },
        h2({ children }) {
          return <h2 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="text-sm font-medium text-foreground mt-2 mb-1">{children}</h4>;
        },
        p({ children }) {
          return <p className="text-sm leading-relaxed mb-2 text-foreground/90">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside space-y-1 my-2 text-sm text-foreground/90">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside space-y-1 my-2 text-sm text-foreground/90">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        hr() {
          return <hr className="my-4 border-border" />;
        },
        strong({ children }) {
          return <strong className="font-semibold text-foreground">{children}</strong>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isDark,
  onCopy,
  onRegenerate,
  isLast,
  isGenerating,
}: {
  message: Message;
  isDark: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  isLast: boolean;
  isGenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3 group">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground text-sm leading-relaxed">
          {message.content}
        </div>
        <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-4 w-4 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          {message.isStreaming && message.content === "" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-xs">Generating…</span>
            </div>
          ) : (
            <MarkdownContent content={message.content} isDark={isDark} />
          )}
          {message.isStreaming && message.content.length > 0 && (
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
        {!message.isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {isLast && !isGenerating && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </button>
            )}
            <span className="text-[10px] text-muted-foreground/60 ml-1">{formatTime(message.timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Prompt Cards ───────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: TestTube, label: "Generate Login Test Cases", color: "text-blue-500", bg: "bg-blue-500/10" },
  { icon: AlertTriangle, label: "Explain Failed API", color: "text-orange-500", bg: "bg-orange-500/10" },
  { icon: GitBranch, label: "Create Regression Suite", color: "text-violet-500", bg: "bg-violet-500/10" },
  { icon: Bug, label: "Generate Bug Report", color: "text-red-500", bg: "bg-red-500/10" },
  { icon: Activity, label: "Analyze Logs", color: "text-green-500", bg: "bg-green-500/10" },
];

const CAPABILITIES = [
  { icon: FileCode2, label: "Playwright & Cypress Scripts" },
  { icon: Package, label: "Postman Collections" },
  { icon: Database, label: "SQL Query Generation" },
  { icon: FileText, label: "Release Notes & Docs" },
  { icon: BarChart3, label: "Sprint Summaries" },
  { icon: Code2, label: "Stack Trace Analysis" },
  { icon: BookOpen, label: "API Documentation" },
  { icon: Zap, label: "Root Cause Analysis" },
];

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mb-5">
        <Bot className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">AI QA Copilot</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-8">
        Your enterprise AI assistant for test generation, log analysis, API debugging,
        and every QA workflow in between.
      </p>

      {/* Capabilities grid */}
      <div className="grid grid-cols-4 gap-2 mb-8 max-w-2xl w-full">
        {CAPABILITIES.map(c => (
          <div
            key={c.label}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <c.icon className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground text-center leading-tight">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Quick prompt cards */}
      <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => onPrompt(p.label)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-sm font-medium text-foreground"
            )}
          >
            <span className={cn("flex items-center justify-center h-6 w-6 rounded-lg", p.bg)}>
              <p.icon className={cn("h-3.5 w-3.5", p.color)} />
            </span>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Conversation Sidebar ─────────────────────────────────────────────────────

function ConversationSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isDark,
  onToggleDark,
  collapsed,
  onToggleCollapse,
}: {
  sessions: Session[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isDark: boolean;
  onToggleDark: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const groups = useMemo(() => groupByDate(sessions), [sessions]);

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 overflow-hidden",
        collapsed ? "w-12" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border flex-shrink-0 h-14">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground truncate">AI Copilot</span>
            <Badge className="text-[9px] px-1.5 bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border-0">
              Beta
            </Badge>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* New Chat */}
      <div className={cn("px-2 py-2 flex-shrink-0", collapsed && "px-1")}>
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center gap-2 rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors text-sm font-medium",
            collapsed ? "justify-center p-2" : "px-3 py-2"
          )}
          title="New Chat"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          {!collapsed && "New Chat"}
        </button>
      </div>

      {/* Session list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-1">
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8 px-4">No conversations yet</p>
          ) : (
            groups.map(group => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 mb-1">
                  {group.label}
                </p>
                {group.items.map(s => (
                  <div key={s.id} className="group relative mx-1">
                    <button
                      onClick={() => onSelect(s.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors pr-7",
                        s.id === activeId
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs truncate">{s.title}</span>
                    </button>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className={cn("border-t border-border p-2 flex flex-shrink-0", collapsed ? "justify-center" : "justify-between items-center")}>
        {!collapsed && (
          <span className="text-[10px] text-muted-foreground/60">⌘K — new chat</span>
        )}
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Chat Input ───────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onStop,
  isGenerating,
}: {
  onSend: (msg: string) => void;
  onStop: () => void;
  isGenerating: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-background border border-border rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          {/* Voice button */}
          <button
            className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-0.5"
            title="Voice input (coming soon)"
            type="button"
          >
            <Mic className="h-4 w-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask the AI Copilot anything — test generation, log analysis, RCA…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none leading-relaxed min-h-[24px] max-h-40 py-0.5"
            disabled={isGenerating}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
            {isGenerating ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-xs font-medium"
                type="button"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim()}
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          AI responses are illustrative — verify outputs before use in production. Press Enter to send, Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiCopilot() {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeId, setActiveId] = useState<string | undefined>(() => loadSessions()[0]?.id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const stopRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeId);
  const messages = activeSession?.messages ?? [];

  // Persist on change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Keyboard shortcut: Cmd+K → new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleDark = useCallback(() => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    setIsDark(html.classList.contains("dark"));
  }, []);

  const handleNewChat = useCallback(() => {
    const id = uid();
    const session: Session = {
      id,
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSessions(prev => [session, ...prev]);
    setActiveId(id);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = sessions.filter(s => s.id !== id);
      return remaining[0]?.id;
    });
  }, [sessions]);

  const streamResponse = useCallback((fullText: string, sessionId: string, assistantMsgId: string) => {
    let pos = 0;
    stopRef.current = false;
    setIsGenerating(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (stopRef.current || pos >= fullText.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        // Finalize
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: stopRef.current ? m.content : fullText, isStreaming: false }
                : m
            ),
          };
        }));
        setIsGenerating(false);
        return;
      }
      const chunkSize = 5 + Math.floor(Math.random() * 12);
      pos = Math.min(pos + chunkSize, fullText.length);
      const displayed = fullText.slice(0, pos);
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: displayed } : m
          ),
        };
      }));
    }, 18);
  }, []);

  const handleSend = useCallback((text: string) => {
    let sessionId = activeId;

    // Create session if none active
    if (!sessionId) {
      sessionId = uid();
      const newSession: Session = {
        id: sessionId,
        title: text.slice(0, 48) + (text.length > 48 ? "…" : ""),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveId(sessionId);
    }

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const assistantMsgId = uid();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    };

    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const updated = [...s.messages, userMsg, assistantMsg];
      return {
        ...s,
        title: s.messages.length === 0 ? (text.slice(0, 48) + (text.length > 48 ? "…" : "")) : s.title,
        messages: updated,
        updatedAt: new Date(),
      };
    }));

    // Small delay before streaming starts
    setTimeout(() => {
      const response = getMockResponse(text);
      streamResponse(response, sessionId!, assistantMsgId);
    }, 350);
  }, [activeId, streamResponse]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!activeSession || activeSession.messages.length < 2) return;
    const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) return;

    // Remove last assistant message and re-send
    setSessions(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const msgs = [...s.messages];
      const lastAssistant = msgs.slice().reverse().find(m => m.role === "assistant");
      if (lastAssistant) {
        const idx = msgs.indexOf(lastAssistant);
        msgs.splice(idx, 1);
      }
      return { ...s, messages: msgs };
    }));

    setTimeout(() => {
      const sessionId = activeId!;
      const assistantMsgId = uid();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: new Date(),
      };
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, messages: [...s.messages, assistantMsg], updatedAt: new Date() };
      }));
      const response = getMockResponse(lastUserMsg.content);
      streamResponse(response, sessionId, assistantMsgId);
    }, 100);
  }, [activeSession, activeId, streamResponse]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => { });
  }, []);

  return (
    <div
      className="-m-6 md:-m-8 flex overflow-hidden bg-background"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Sidebar */}
      <ConversationSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        onDelete={handleDeleteSession}
        isDark={isDark}
        onToggleDark={toggleDark}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(p => !p)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-5 bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">
              {activeSession?.title ?? "AI QA Copilot"}
            </h1>
            {isGenerating && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating…
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] border-0 shadow-sm">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              Copilot Pro
            </Badge>
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => {
                  if (!activeId) return;
                  setSessions(prev => prev.map(s =>
                    s.id === activeId ? { ...s, messages: [] } : s
                  ));
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <EmptyState onPrompt={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isDark={isDark}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  isLast={i === messages.length - 1}
                  isGenerating={isGenerating}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
