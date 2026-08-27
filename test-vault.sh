#!/bin/bash
set -e
BASE="http://localhost:3000"
COOKIES=/tmp/vault-cookies.txt
rm -f $COOKIES

echo "═══════════════════════════════════════════════════════════════"
echo "  DOCUMENT VAULT E2E TEST"
echo "═══════════════════════════════════════════════════════════════"

# 1. Clean old test data using raw SQL for FK safety
echo ""
echo "▶ Step 0: Clean old test data..."
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tables = [
    'ExtractedField', 'VaultDocumentExtraction', 'ApplicationDocument', 'ApplicationFormValue',
    'Application', 'DocumentVault', 'Notification', 'BidDocument',
    'ComplianceResult', 'EvidenceItem', 'Anomaly', 'RiskScore', 'VerificationResult',
    'BidSubmission', 'AuditLog', 'AiRun', 'Report', 'SavedTender',
    'PasswordReset'
  ];
  for (const t of tables) {
    await p.\$executeRawUnsafe('DELETE FROM \"' + t + '\"').catch(() => {});
  }
  await p.user.deleteMany({ where: { email: { contains: 'vaulttest' } } });
  await p.organization.deleteMany({ where: { legalName: { contains: 'Vault Test' } } });
  console.log('Cleaned');
  await p.\$disconnect();
})();
"

# 2. Register a test user
echo ""
echo "▶ Step 1: Register test user..."
curl -s -c $COOKIES -b $COOKIES -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vault Test User",
    "email": "vaulttest2@example.com",
    "password": "Test1234!",
    "phone": "9876543211",
    "organization": {
      "legalName": "Vault Test Corp Two",
      "pan": "ABCVT1234G",
      "gstin": "27ABCVT1234G1Z5",
      "udyamNumber": "UDYAM-MH-01-0000002",
      "registeredAddress": "456 Test Avenue, Delhi",
      "state": "Delhi",
      "city": "New Delhi",
      "phone": "9876543211",
      "organizationType": "PUBLIC_LIMITED",
      "businessCategory": "SERVICE_PROVIDER",
      "annualTurnoverLakh": 10000,
      "isStartup": true
    }
  }' | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));  d.ok ? 'OK - userId=' + d.data.userId : 'FAIL - ' + d.error"

# 3. Upload documents to vault
echo ""
echo "▶ Step 2: Upload documents to vault..."
mkdir -p /tmp/vault-test
echo "GST Registration Certificate
GSTIN: 27ABCVT1234G1Z5
Legal Name: Vault Test Corp Two
Date of Registration: 2019-04-01
Valid Until: 2027-03-31" > /tmp/vault-test/gst-cert.txt

echo "PAN Card
Name: VAULT TEST CORP TWO
PAN: ABCVT1234G
Date of Issue: 2018-06-15" > /tmp/vault-test/pan-card.txt

echo "Udyam Registration Certificate
Udyam Number: UDYAM-MH-01-0000002
Enterprise Name: Vault Test Corp Two
Date of Registration: 2020-08-20
Valid Until: 2028-07-31" > /tmp/vault-test/udyam-cert.txt

echo "Experience Certificate
Vault Test Corp Two has successfully completed
Duration: April 2019 to March 2025
Total Experience: 6 years
Contract Value: Rs. 5,00,00,000
Client: Ministry of Electronics and IT" > /tmp/vault-test/experience-cert.txt

echo "Turnover Certificate
Annual Turnover FY 2024-25: Rs. 10,00,00,000
Certified by: CA Rajesh Kumar
Date: 2025-06-30" > /tmp/vault-test/turnover-proof.txt

echo "ISO 9001:2015 Quality Management Certificate
Certificate Number: ISO-9001-2024-001
Issue Date: 2024-01-15
Expiry Date: 2027-01-14" > /tmp/vault-test/iso-cert.txt

echo "OEM Authorization Letter
We authorize Vault Test Corp Two as our authorized dealer
Valid From: 2024-01-01
Valid Until: 2026-12-31" > /tmp/vault-test/oem-auth.txt

for DOC_FILE in gst-cert.txt pan-card.txt udyam-cert.txt experience-cert.txt turnover-proof.txt iso-cert.txt oem-auth.txt; do
  case $DOC_FILE in
    gst-cert.txt) TYPE="GST_CERTIFICATE"; CAT="IDENTITY";;
    pan-card.txt) TYPE="PAN_CARD"; CAT="IDENTITY";;
    udyam-cert.txt) TYPE="UDYAM_CERTIFICATE"; CAT="IDENTITY";;
    experience-cert.txt) TYPE="EXPERIENCE_CERTIFICATE"; CAT="EXPERIENCE";;
    turnover-proof.txt) TYPE="TURNOVER_PROOF"; CAT="FINANCIAL";;
    iso-cert.txt) TYPE="COMPANY_CERTIFICATE"; CAT="TECHNICAL";;
    oem-auth.txt) TYPE="OEM_AUTHORIZATION"; CAT="TECHNICAL";;
  esac
  RESULT=$(curl -s -b $COOKIES -X POST "$BASE/api/bidder/vault" \
    -F "docType=$TYPE" -F "category=$CAT" -F "files=@/tmp/vault-test/$DOC_FILE")
  STATUS=$(echo "$RESULT" | node -pe "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));d.ok?'OK ('+d.data.documents[0].status+')':'FAIL: '+d.error}catch(e){'ERROR'}")
  echo "  $DOC_FILE → $STATUS"
done

# 4. Check vault
echo ""
echo "▶ Step 3: Check vault..."
curl -s -b $COOKIES "$BASE/api/bidder/vault" | node -pe "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if(!d.ok) { 'FAIL'; process.exit(1); }
const s=d.data.stats;
'Vault: '+s.total+' docs, '+s.verified+' verified, '+s.needsAttention+' need attention';
"

# 5. Create tender
echo ""
echo "▶ Step 4: Create tender..."
TENDER_ID=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  let tender = await p.tender.findFirst({ where: { tenderNumber: 'VAULT/TEST/2026/001' } });
  if (!tender) {
    tender = await p.tender.create({
      data: {
        tenderNumber: 'VAULT/TEST/2026/001',
        title: 'IT Infrastructure Modernization',
        description: 'Procurement of enterprise servers for government data center.',
        buyerOrganization: 'Ministry of Electronics and IT',
        department: 'IT Infrastructure Division',
        category: 'IT Hardware', state: 'Delhi', city: 'New Delhi',
        publishDate: new Date(), closingDate: new Date(Date.now() + 30 * 86400000),
        estimatedValueLakh: 5000, emdAmount: 500000,
        status: 'ACTIVE', requirementsFrozen: true,
      },
    });
  }
  const reqs = [
    { code: 'R1', type: 'GST_REGISTRATION', title: 'Valid GST Registration Certificate', mandatory: true, description: 'GST certificate with valid GSTIN' },
    { code: 'R2', type: 'PAN', title: 'PAN Card', mandatory: true, description: 'Valid PAN card' },
    { code: 'R3', type: 'UDYAM', title: 'Udyam/MSME Registration', mandatory: true, description: 'Valid Udyam certificate' },
    { code: 'R4', type: 'EXPERIENCE', title: 'Experience Certificate', mandatory: true, description: 'Minimum 5 years experience' },
    { code: 'R5', type: 'TURNOVER', title: 'Turnover Certificate', mandatory: true, description: 'Minimum turnover Rs. 2 Crore' },
    { code: 'R6', type: 'OEM_AUTHORIZATION', title: 'OEM Authorization', mandatory: false, description: 'Manufacturer authorization' },
    { code: 'R7', type: 'CERTIFICATE', title: 'ISO Certificate', mandatory: false, description: 'ISO 9001 certification' },
  ];
  for (const r of reqs) {
    await p.tenderRequirement.upsert({
      where: { tenderId_code: { tenderId: tender.id, code: r.code } },
      update: { status: 'APPROVED', mandatory: r.mandatory },
      create: { ...r, tenderId: tender.id, status: 'APPROVED', evidenceRequired: true, confidence: 0.95, extractionMethod: 'AI' },
    });
  }
  console.log(tender.id);
  await p.\$disconnect();
})();
")
echo "  Tender ID: $TENDER_ID"

# 6. Create application
echo ""
echo "▶ Step 5: Create application (Apply With My Documents)..."
APP_RESULT=$(curl -s -b $COOKIES -X POST "$BASE/api/bidder/applications" \
  -H "Content-Type: application/json" \
  -d "{\"tenderId\":\"$TENDER_ID\"}")
APP_ID=$(echo "$APP_RESULT" | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!d.ok){console.error(d.error);process.exit(1);} d.data.applicationId")
echo "$APP_RESULT" | node -pe "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const m=d.data.matchResult;
'Created: '+d.data.applicationId+' | Matched: '+m.matched+'/'+m.total+' docs | Progress: '+d.data.progress+'%';
"

# 7. Run validation
echo ""
echo "▶ Step 6: Pre-submission validation..."
VALIDATE=$(curl -s -b $COOKIES -X POST "$BASE/api/bidder/applications/$APP_ID/validate")
echo "$VALIDATE" | node -pe "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if(!d.ok){console.error(d.error);process.exit(1);}
const v=d.data;
const pass=v.requirementChecks?.filter(c=>c.status==='PASS').length||0;
const fail=v.requirementChecks?.filter(c=>c.status==='FAIL').length||0;
const warn=v.requirementChecks?.filter(c=>c.status==='WARNING').length||0;
'Overall: '+v.overallStatus+' | PASS:'+pass+' FAIL:'+fail+' WARN:'+warn+' | Can submit: '+v.canSubmit;
"

# 8. Submit application
echo ""
echo "▶ Step 7: Submit application..."
SUBMIT=$(curl -s -b $COOKIES -X POST "$BASE/api/bidder/applications/$APP_ID/submit")
echo "$SUBMIT" | node -pe "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if(!d.ok){console.error(d.error);process.exit(1);}
'Submitted! Bid: '+d.data.bidNumber+' | Docs: '+d.data.documentsAttached;
"

# 9. Check notifications
echo ""
echo "▶ Step 8: Check notifications..."
curl -s -b $COOKIES "$BASE/api/notifications" | node -pe "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if(!d.ok){'FAIL';process.exit(1);}
d.data.notifications.slice(0,5).map((x,i)=>'  '+(i+1)+'. ['+x.kind+'] '+x.title).join('\n');
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ DOCUMENT VAULT E2E TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
