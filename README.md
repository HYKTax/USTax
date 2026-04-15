# TaxMind AI — Backend API

> The AI-powered tax preparation and QuickBooks accounting platform for CPA firms.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| AI Engine | Anthropic Claude (claude-sonnet-4-20250514) |
| OCR | Tesseract.js + pdf-parse |
| Auth | JWT (access + refresh tokens) |
| Payments | Stripe |
| QuickBooks | OAuth 2.0 + Intuit API |
| Email | Nodemailer (SMTP) |
| Validation | Joi |
| Logging | Winston |
| Scheduling | node-cron |
| File Upload | Multer |

---

## Quick Start

```bash
# 1. Clone & install
cd taxmind-backend
npm install

# 2. Configure environment
cp .env.example .env
# Fill in all values (MongoDB, Anthropic key, Stripe, QB credentials, SMTP)

# 3. Seed demo data
npm run seed

# 4. Start development server
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:5000`  
Health check: `GET /health`

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Strong random secret for access tokens |
| `JWT_REFRESH_SECRET` | Separate secret for refresh tokens |
| `ANTHROPIC_API_KEY` | Claude API key (`sk-ant-...`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks |
| `STRIPE_SOLO_PRICE_ID` | Stripe Price ID for Solo plan |
| `STRIPE_FIRM_PRICE_ID` | Stripe Price ID for Firm plan |
| `QB_CLIENT_ID` | QuickBooks app client ID |
| `QB_CLIENT_SECRET` | QuickBooks app client secret |
| `QB_REDIRECT_URI` | `http://localhost:5000/api/v1/quickbooks/callback` |
| `QB_ENVIRONMENT` | `sandbox` or `production` |
| `SMTP_HOST` | SMTP server host |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `CLIENT_URL` | Frontend URL (for email links & CORS) |

---

## API Reference

Base URL: `/api/v1`

All protected routes require: `Authorization: Bearer <token>`

---

### Authentication — `/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register firm + admin user |
| POST | `/auth/login` | Public | Login, get JWT |
| POST | `/auth/logout` | 🔒 | Clear auth cookie |
| POST | `/auth/refresh-token` | Public | Exchange refresh token |
| POST | `/auth/forgot-password` | Public | Send reset email |
| PUT | `/auth/reset-password/:token` | Public | Reset password |
| GET | `/auth/verify-email/:token` | Public | Verify email |
| GET | `/auth/me` | 🔒 | Get current user + firm |
| PUT | `/auth/me` | 🔒 | Update profile |
| PUT | `/auth/change-password` | 🔒 | Change password |
| POST | `/auth/invite` | 🔒 Admin/Manager | Invite team member |
| GET | `/auth/team` | 🔒 | List team members |

---

### Documents — `/documents`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/documents` | 🔒 | Upload 1–20 documents (multipart) |
| GET | `/documents/client/:clientId` | 🔒 | List client documents |
| GET | `/documents/missing/:taxReturnId` | 🔒 | AI-detected missing docs |
| POST | `/documents/batch/:taxReturnId` | 🔒 | Batch AI extract all pending docs |
| GET | `/documents/:id` | 🔒 | Get document metadata |
| GET | `/documents/:id/extracted` | 🔒 | Get AI extraction results + tax mappings |
| POST | `/documents/:id/re-extract` | 🔒 | Re-run AI extraction |
| PATCH | `/documents/:id/flags/:flagId` | 🔒 | Resolve AI-detected flag |
| DELETE | `/documents/:id` | 🔒 | Soft delete document |

**Upload field name:** `files` (multipart/form-data)  
**Accepted types:** PDF, JPG, PNG, TIFF, XLSX, CSV  
**Max size:** 50MB per file, 20 files per request

---

### Tax Returns — `/tax-returns`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/tax-returns` | 🔒 | Create tax return |
| GET | `/tax-returns` | 🔒 | List returns (filter by status/year/cpa) |
| GET | `/tax-returns/:id` | 🔒 | Get return + documents + workpapers |
| PUT | `/tax-returns/:id` | 🔒 | Update return |
| PATCH | `/tax-returns/:id/status` | 🔒 | Advance workflow status |
| POST | `/tax-returns/:id/generate-workpaper` | 🔒 | Trigger AI workpaper generation |
| GET | `/tax-returns/:id/timeline` | 🔒 | Status change history |
| PATCH | `/tax-returns/:id/filed` | 🔒 | Mark as filed with confirmation # |
| DELETE | `/tax-returns/:id` | 🔒 Admin | Soft delete |

**Workflow statuses (in order):**
```
not_started → documents_pending → ai_processing → ai_complete
→ preliminary_review → cpa_review → manager_review → client_approval → filed
```

---

### AI Tax Assistant — `/ai-assistant`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/ai-assistant/message` | 🔒 | Send chat message (multi-turn) |
| POST | `/ai-assistant/quick-answer` | 🔒 | Single-turn quick question |
| GET | `/ai-assistant/sessions` | 🔒 | List chat sessions |
| GET | `/ai-assistant/sessions/:sessionId` | 🔒 | Get session with full history |
| PATCH | `/ai-assistant/sessions/:sessionId/archive` | 🔒 | Archive session |
| GET | `/ai-assistant/usage` | 🔒 | Token usage stats |

**Chat request body:**
```json
{
  "message": "Can a self-employed taxpayer deduct home office expenses?",
  "sessionId": "uuid (optional — omit to start new session)",
  "clientId": "optional — injects client context",
  "taxReturnId": "optional — injects return context"
}
```

---

### Client Portal — `/client-portal`

**CPA-side (JWT auth):**

| Method | Route | Description |
|---|---|---|
| POST | `/client-portal/clients` | Create client |
| GET | `/client-portal/clients` | List clients (search/filter) |
| GET | `/client-portal/clients/:id` | Get client detail |
| PUT | `/client-portal/clients/:id` | Update client |
| POST | `/client-portal/clients/:id/notes` | Add internal note |
| DELETE | `/client-portal/clients/:id` | Deactivate client |
| POST | `/client-portal/clients/:clientId/resend-portal` | Resend portal link email |
| POST | `/client-portal/clients/document-requests` | Create & email document request |
| GET | `/client-portal/clients/document-requests` | List document requests |
| PATCH | `/client-portal/clients/document-requests/:id` | Mark document received |

**Client-facing portal (x-client-token header):**

| Method | Route | Description |
|---|---|---|
| GET | `/client-portal/portal/me` | Client info + pending requests |
| GET | `/client-portal/portal/documents` | Client's uploaded documents |
| POST | `/client-portal/portal/upload` | Upload documents (field: `files`) |

---

### CPA Review — `/cpa-review`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/cpa-review/queue` | 🔒 | Returns awaiting review |
| GET | `/cpa-review/stats` | 🔒 | Review queue KPIs |
| GET | `/cpa-review/workpapers/:id` | 🔒 | Get workpaper detail |
| POST | `/cpa-review/preliminary` | 🔒 Firm+ | Submit preliminary review |
| POST | `/cpa-review/:id/cpa-review` | 🔒 | Submit CPA sign-off |
| POST | `/cpa-review/:id/manager-review` | 🔒 Manager | Submit manager approval |
| POST | `/cpa-review/:id/flags` | 🔒 | Add flag to return |
| PATCH | `/cpa-review/:id/flags/:flagId` | 🔒 | Resolve flag |

---

### QuickBooks — `/quickbooks`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/quickbooks/auth-url` | 🔒 | Get OAuth authorization URL |
| GET | `/quickbooks/callback` | Public | OAuth redirect handler |
| GET | `/quickbooks/status` | 🔒 | Connection status |
| DELETE | `/quickbooks/disconnect` | 🔒 | Disconnect QB |
| POST | `/quickbooks/sync` | 🔒 | Sync transactions from QB |
| GET | `/quickbooks/transactions` | 🔒 | List transactions (filter/paginate) |
| PATCH | `/quickbooks/transactions/:id` | 🔒 | Manually categorize transaction |
| POST | `/quickbooks/transactions/bulk` | 🔒 | Bulk categorize |
| POST | `/quickbooks/reconcile` | 🔒 | Mark transactions reconciled |
| GET | `/quickbooks/pl-summary` | 🔒 | P&L summary for tax year |
| POST | `/quickbooks/re-categorize` | 🔒 Firm+ | AI re-categorize low-confidence |

---

### Subscriptions — `/subscriptions`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/subscriptions/plans` | Public | Get all plan details |
| GET | `/subscriptions` | 🔒 | Current subscription |
| POST | `/subscriptions` | 🔒 Admin | Create/upgrade subscription |
| DELETE | `/subscriptions` | 🔒 Admin | Cancel subscription |
| GET | `/subscriptions/billing-portal` | 🔒 Admin | Stripe billing portal URL |
| POST | `/subscriptions/webhook` | Public | Stripe webhook handler |

---

### Waitlist — `/waitlist`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/waitlist` | Public | Join waitlist |
| GET | `/waitlist` | 🔒 Admin | List all waitlist entries |
| POST | `/waitlist/:id/approve` | 🔒 Admin | Approve + send invite email |

---

### Dashboard — `/dashboard`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | 🔒 | Firm KPIs, deadlines, activity |
| GET | `/dashboard/workload` | 🔒 | Per-CPA workload breakdown |

---

## Subscription Plans & Feature Gates

| Feature | Solo | Firm | Enterprise |
|---|---|---|---|
| Returns/year | 150 | 600 | Unlimited |
| Team members | 1 | 8 | Unlimited |
| 1040 Autopilot | ✅ | ✅ | ✅ |
| AI Tax Assistant | ✅ | ✅ | ✅ |
| Client Portal | ✅ | ✅ | ✅ |
| QB Integration | ✅ | ✅ | ✅ |
| Preliminary CPA Review | ❌ | ✅ | ✅ |
| Manager Review Dashboard | ❌ | ✅ | ✅ |
| AI Re-categorization | ❌ | ✅ | ✅ |
| SSO / Custom API | ❌ | ❌ | ✅ |

---

## Security

- **Helmet** — HTTP security headers
- **CORS** — Origin whitelist via `CORS_ORIGIN`
- **Mongo Sanitize** — NoSQL injection prevention
- **Rate limiting** — Auth: 20/15min, AI: 20/min, Upload: 200/hr
- **JWT** — Short-lived access (7d) + refresh (30d) tokens
- **bcryptjs** — Password hashing (12 rounds)
- **Client portal tokens** — Separate short-lived JWT (72h), `type: 'client'`
- **Soft deletes** — Documents and returns never hard-deleted
- **Firm isolation** — Every query scoped by `firm: firmId`

---

## Cron Jobs

| Schedule | Job | Description |
|---|---|---|
| Daily 9:00 AM | `runReminderJob` | Send document reminder emails to clients |
| Sunday 2:00 AM | `runCleanupJob` | Delete orphaned files, clear expired tokens, mark overdue requests |

---

## AI Integration Details

### Document Extraction Pipeline
```
File upload → Multer → Disk storage
  → Tesseract.js OCR (images) / pdf-parse (PDFs)
  → Claude: classify form type, extract fields, map to 1040 lines
  → Store: extractedData, taxFieldMappings, flags, confidence
  → Notify: update TaxReturn status
```

### Workpaper Generation
```
TaxReturn selected → Aggregate all extracted docs
  → Build income/deduction/credit summaries
  → Claude: generate structured workpaper with CPA review notes
  → Store Workpaper with sections, source refs, preliminary review
  → Advance TaxReturn to ai_complete
```

### Tax AI Assistant
```
User message → Build system prompt (IRC + client context)
  → Retrieve session history (last 20 messages)
  → Claude: multi-turn conversation
  → Persist to AiChatSession (token tracking)
  → Return reply with citation hints
```

### QuickBooks Reconciliation
```
OAuth connect → Intuit API → Fetch transactions
  → Per-transaction: Claude categorize (category, deductibility, IRC ref)
  → Store with aiCategory, confidence, taxCategory
  → Generate P&L: group by category, sum deductible expenses
  → Reconciliation: mark matched, flag duplicates
```

---

## Demo Credentials (after `npm run seed`)

```
Admin:   admin@taxmindai.demo    / Admin1234!
Manager: manager@taxmindai.demo  / Manager1234!
CPA 1:   cpa1@taxmindai.demo     / Cpa12345!
CPA 2:   cpa2@taxmindai.demo     / Cpa12345!
```
