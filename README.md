# BIDGUARD AI — Government Bid Compliance Verification Platform

> AI-powered platform for automated document verification, compliance checking, and bid evaluation for government tenders.

## Quick Start

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Bidder** | `sunil.kumar@abcindustries.example` | `password123` |
| **Super Admin** | `admin@bidverify.ai` | `admin@bidverify2026` |
| Procurement Officer | `rajesh.verma@procurement.gov.in` | `password123` |
| Bid Evaluation Officer | `priya.singh@procurement.gov.in` | `password123` |
| Auditor | `auditor@procurement.gov.in` | `password123` |
| Compliance Reviewer | `compliance@procurement.gov.in` | `password123` |

Additional bidder accounts (all password: `password123`):
- `amit.sharma@example.com` — Sharma Engineering Works, Pune
- `priya.patel@example.com` — Patel Tech Solutions, Ahmedabad
- `vikram.singh@example.com` — Singh Manufacturing Co., Delhi
- `ananya.reddy@example.com` — Reddy Infra Pvt Ltd, Hyderabad
- `rahul.joshi@example.com` — Joshi Electrical Works, Bangalore
- `sneha.gupta@example.com` — Gupta Supply Chain Ltd, Lucknow
- `arjun.nair@example.com` — Nair Marine Services, Kochi

### Run Locally

```bash
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Server runs at `http://localhost:3000`.

---

## How It Works — Complete Feature Guide

### 1. Document Vault — Upload & Verify

**What happens when a user uploads a real document:**

#### Step-by-step flow:
1. Bidder goes to **Dashboard → Document Vault**
2. Clicks **"Upload Document"**
3. Selects document category (Identity, Financial, Experience, Technical, Other)
4. Selects specific document type (PAN Card, GST Certificate, Udyam Certificate, etc.)
5. Drag-and-drops or clicks to upload files (PDF/PNG/JPG, max 25MB)
6. If PDF is encrypted, a password field appears automatically
7. Clicks **"Upload"**

#### Progress phases shown:
```
Uploading... → Reading document... → Extracting text... → Running verification... → Calculating score... → Finalizing...
```

#### Behind the scenes — 12-step verification pipeline:

| Step | What Happens |
|------|-------------|
| 1. File Intake | Validates file size (100 bytes–50MB), format (PDF/Image only) |
| 2. Encryption Detection | Detects `/Encrypt` markers in PDF, tries common passwords |
| 3. Native Text Extraction | Decompresses PDF streams, extracts BT...ET text blocks |
| 4. Text Quality Gate | Checks if extracted text is garbage (printable char ratio >50%) |
| 5. OCR Fallback | If native text <50 chars or garbage, runs Tesseract OCR |
| 6. **Document-Type Rules Engine** | **HARD GATE** — type-specific validation (see below) |
| 7. QR/Barcode Verification | Scans QR codes, decodes, compares with extracted fields |
| 8. Digital Signature Detection | Detects ByteRange, Sig dictionaries, PKCS#7 structures |
| 9. Tamper/Forensic Analysis | PDF forensics (incremental updates, JS, embedded files, fonts) + Image forensics |
| 10. Structural Consistency | Checks if expected field labels are present in text |
| 11. Weighted Scoring | Combines all evidence into 0–100 score |
| 12. Status Determination | Maps score to status + human-readable message |

#### Score Ranges:

| Score | Status | Meaning |
|-------|--------|---------|
| **75–100** | ✅ **VERIFIED** | Document passed all checks. Real, valid document. |
| **45–74** | ⚠️ **NEEDS_REVIEW** | Document found but some checks uncertain. Officer will review. |
| **0–44** | ❌ **FAILED** | Insufficient evidence or wrong document type. |
| — | 🔒 **PASSWORD_REQUIRED** | PDF is encrypted, could not be decrypted. |

#### Hard Gate — What makes score HIGH (~85) vs LOW (~0):

**Real PAN Card → Score ~85/100:**
- ✅ Correct document type detected (content matches "permanent account number", "income tax department")
- ✅ Valid PAN format `ABCDE1234F` with valid entity type letter
- ✅ Supporting fields found: Name, DOB, Father's name
- ✅ Good native PDF text extraction (>200 chars)
- ✅ QR code present and consistent with extracted data
- ✅ No tamper signals in forensic analysis

**Fake/Wrong Document → Score ~0/10:**
- ❌ Hard gate failure: Required identifier NOT found (e.g., no PAN pattern in PAN_CARD upload)
- ❌ Wrong document type uploaded (e.g., GST cert uploaded as PAN Card → forbidden keywords trigger immediate fail)
- ❌ Core concepts not met (fewer than required keywords found)
- ❌ No extractable text (image-only PDF, corrupted file, or OCR failure)

**Score breakdown for PAN Card:**
| Component | Max Points |
|-----------|-----------|
| Document Type Match | 25 |
| Required Identifier (PAN) | 25 |
| Supporting Fields (name, DOB, etc.) | 15 |
| OCR Confidence | 10 |
| QR/Barcode Verification | 10 |
| Digital Signature | 5 |
| Structural Consistency | 5 |
| Tamper Analysis | 5 |

**Forbidden keywords trigger immediate FAIL:**
- PAN Card upload contains "gstin", "goods and services tax", "udyam", "msme" → FAIL (wrong document type)
- GST Certificate upload contains "permanent account number", "income tax" → FAIL

---

### 2. One-Click Form Fill — Organization Auto-Fill

**How it works:**

1. Bidder opens an application at `/bidder/applications/[id]`
2. Page has 3 collapsible sections:
   - **Section 1:** Organization Details (7 fields)
   - **Section 2:** Required Documents
   - **Section 3:** Review & Submit
3. In Section 1, clicks **"Auto-fill"** button
4. All fields instantly populated from organization profile:
   - Legal Name, PAN, GSTIN, Udyam Number, Registered Address, State, City
5. Values are saved to server immediately
6. User can edit any field after auto-fill

**Behind the scenes:**
- `profileAutoFill` API returns stored organization fields
- `autoFillProfile()` merges existing values with profile (existing values take precedence)
- POST to application API persists the form values

---

### 3. Admin Panel — Pass / Fail / Hold

**Three decision buttons on every submitted bid:**

| Button | Decision | Effect |
|--------|----------|--------|
| 🟢 **PASS** | `COMPLIANT` | Bid approved. Bidder notified. |
| 🟡 **HOLD** | `CONDITIONAL` | Bid held for review. Bidder notified. |
| 🔴 **FAIL** | `NON_COMPLIANT` | Bid rejected. Bidder notified. |

#### Flow:
1. Admin clicks **"Review Bids"** tab
2. Table shows all submitted bids with: Tender, Bidder, Score, Decision
3. For undecided bids, 3 buttons appear
4. Clicking any button → confirmation dialog: "Are you sure? The bidder will be notified immediately."
5. After decision, bid row shows decision label + "Change to" buttons for other options

#### Admin Bid Detail Page (`/admin/bids/[id]`):
- Full bid detail with: Bidder info, Tender info, Compliance score
- Documents section with score badges and inline PDF viewer
- Requirement Matching section (check/cross for each requirement)
- Same 3 decision buttons in Actions section
- "Back to Review Bids" link

---

### 4. Tender Creation — Manual and OCR

#### Manual Tender Creation:
1. Admin clicks **"Create New Tender"** on Tenders tab
2. Fills in: Tender Number, Title, Buyer Organization, Category, State, City, Closing Date, Estimated Value
3. Selects **Required Documents** from 12 checkboxes:
   - GST Certificate, PAN Card, Udyam/MSME, Experience Certificate, Turnover Proof, Company Certificate, Technical Datasheet, OEM Authorization, Local Content, Financial Docs, EMD/Security, BIS Certification
4. Optionally pastes tender text for AI extraction
5. Clicks **"Create Tender with AI Extraction"**

**Behind the scenes:**
- Validates fields, checks for duplicate tender number
- Saves tender as ACTIVE
- AI requirement extraction (deterministic heuristics in demo mode)
- Each requirement becomes a `TenderRequirement` with status `DRAFT`
- Falls back to checkbox selections if AI doesn't extract requirements

#### OCR Tender Creation:
1. Admin fills minimum fields (Tender Number, Title, Buyer Organization, Closing Date)
2. Uploads tender PDF
3. Clicks **"Create Tender from PDF"**

**Behind the scenes:**
- Saves PDF, creates tender with `aiProvider: "OFFICER_OCR"`
- Creates requirements from selected checkboxes
- Runs `pdftotext` to extract text from PDF
- Returns OCR preview to admin

---

### 5. PDF Scan — Auto-Fill Tender Form from PDF

**How it works:**

1. Admin uploads PDF in tender creation form
2. Immediately on file selection, `handleScanPdf()` triggers
3. "Scanning PDF and extracting fields..." indicator appears
4. Once done, **all form fields auto-filled from PDF**

**PDF parsing uses positional key-value extraction:**

| Field | How It's Found |
|-------|---------------|
| Tender Number | Regex: `XX/XX/2026/NNN` patterns |
| Title | First substantial line (>15 chars) after skipping headers |
| Buyer Organization | Positional block extraction from label:value pairs |
| Closing Date | Regex near "closing"/"deadline"/"last date" keywords |
| Estimated Value | Converts to lakhs: Rs./INR → ÷100000, crore → ×100, lakh → direct |
| State | Scans for known Indian state names |
| Required Documents | Keyword detection: `gst registration` → GST_CERTIFICATE, `pan card` → PAN_CARD, etc. |

**This endpoint is READ-ONLY** — it only returns parsed data, does NOT create database records.

---

### 6. Bid Submission — Full Application Workspace

**3-Section Workflow:**

#### Section 1: Organization Details
- 7 editable fields with auto-fill from profile
- Fields: Legal Name, PAN, GSTIN, Udyam Number, Registered Address, State, City
- Copy-to-clipboard buttons on each field

#### Section 2: Required Documents
- Lists all tender requirements with:
  - Requirement code (R1, R2, etc.), title, description
  - Mandatory/Optional badge
  - Check/cross icon (attached or not)
  - For attached: file name, match type, detach button (X)
- Missing documents have two options:
  - **"Upload File"** — inline file upload (saves to vault)
  - **"From Vault"** — modal showing all vault documents with search + Attach button
- Progress bar: X/Y documents attached, Z mandatory missing

#### Section 3: Review & Submit
1. **Pre-Submission Check** — "Run Check" button:
   - Validates all mandatory requirements have documents
   - Returns: READY_TO_SUBMIT / READY_WITH_WARNINGS / ACTION_REQUIRED
   - Each check shows PASS/WARNING/FAIL with reason
2. **Submit** — "Submit Application" button:
   - Creates BidSubmission record, triggers verification
   - Shows: "Application Submitted" with links to View My Bid, Notifications
3. **Withdraw** — After submission, "Withdraw Bid" button available

---

### 7. ChatBot — Context-Aware AI Assistant

**Fully context-aware** — knows your data:

| Query | What It Answers |
|-------|----------------|
| "Meri applications dikhao" | Lists all your applications with status, progress, doc count |
| "Mera score kya hai" | Shows compliance scores, risk levels, decisions |
| "Documents kya hain" | Lists vault documents grouped by type |
| "Kyu reject hua" | Shows failed compliance checks with reasons |
| "Notifications" | Shows unread notifications |
| "Mera profile" | Shows organization details (PAN, GSTIN, etc.) |

**Greeting** shows dashboard snapshot: X applications, Y bids, Z docs, N notifications.

**Fallback** handles general queries: tenders, apply flow, security, pricing.

---

### 8. Key Architecture

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 App Router + React 19 |
| Database | Prisma + Supabase PostgreSQL |
| Auth | JWT (jose) + bcrypt |
| Styling | Tailwind 4 + CSS Variables (Apple-style dark theme) |
| AI Verification | Deterministic pipeline (NOT LLM) — regex, checksums, forensics |
| OCR | Tesseract via child process (`ocrRunner.js`) |
| PDF Processing | pdftotext (Poppler) |
| Dev Server | Port 3000, auto-kill via `predev` script |

### Important Notes

- **Verification is deterministic, not AI**: Uses regex, checksums, forensics — no LLM calls. Fast and auditable.
- **Document-type-aware**: Each document type has its own rules, keywords, and scoring weights. Wrong document = score 0.
- **QR verification is evidence-only**: Decoded QR data compared against extracted fields for consistency.
- **Digital signature detection is structural only**: Detects presence but does NOT cryptographically validate certificate chain.
- **Tamper analysis produces signals, not verdicts**: Forensic signals are evidence for officer review, not proof of fraud.
