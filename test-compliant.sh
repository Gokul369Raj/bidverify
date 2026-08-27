#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  COMPLIANT FLOW TEST: Bid Should PASS"
echo "=========================================="

# Clean up old data
echo ">>> Cleaning old test data..."
cd bidverify && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'testcompliant@example.com' }});
  if (u) { await prisma.notification.deleteMany({ where: { userId: u.id }}); await prisma.user.delete({ where: { id: u.id }}); console.log('Deleted old user'); }
  const tenders = await prisma.tender.findMany({ where: { tenderNumber: { contains: 'COMPLIANT' }}});
  for (const t of tenders) {
    await prisma.complianceResult.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.evidenceItem.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.anomaly.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.riskScore.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.verificationResult.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.extractedField.deleteMany({ where: { document: { submission: { tenderId: t.id }}}});
    await prisma.bidDocument.deleteMany({ where: { submission: { tenderId: t.id }}});
    await prisma.bidSubmission.deleteMany({ where: { tenderId: t.id }});
    await prisma.tenderRequirement.deleteMany({ where: { tenderId: t.id }});
    await prisma.tenderDocument.deleteMany({ where: { tenderId: t.id }});
    await prisma.tender.delete({ where: { id: t.id }});
    console.log('Deleted tender:', t.tenderNumber);
  }
  await prisma.\$disconnect();
}
main();
" 2>&1
cd ..

# Step 1: Create tender
echo ""
echo ">>> Step 1: Creating tender..."
TENDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenders \
  -F "title=Supply and Installation of Industrial Centrifugal Pumps" \
  -F "tenderNumber=COMPLIANT/TEST/2026/001" \
  -F "buyerOrganization=Chennai Petroleum Corporation Ltd" \
  -F "category=Industrial Pumps" \
  -F "state=Tamil Nadu" \
  -F "city=Chennai" \
  -F "closingDate=2026-12-31" \
  -F "estimatedValueLakh=2500" \
  -F "runAi=true" \
  -F "tenderText=EMD Amount: Rs 50,00,000. Mandatory Requirements: 1. GST Registration Certificate with valid GSTIN. 2. PAN Card of the company. 3. Udyam MSME Registration Certificate. 4. OEM Authorization Letter from manufacturer. 5. Minimum annual turnover of Rs 500 Lakh for last 3 years. 6. Experience of at least 5 years in supply of industrial pumps. 7. Local content declaration with minimum 40 percent Make in India. 8. ISO 9001:2015 certification. 9. EPFO ESIC compliance certificates. Optional: Startup India recognition. Company registration certificate." \
  --max-time 120)
TENDER_ID=$(echo "$TENDER_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tenderId'])")
REQ_COUNT=$(echo "$TENDER_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['requirementCount'])")
echo "  Tender: $TENDER_ID ($REQ_COUNT requirements)"

# Step 2: Approve all
echo ">>> Step 2: Approving requirements..."
curl -s -X POST "http://localhost:3000/api/tenders/$TENDER_ID/requirements" \
  -H "Content-Type: application/json" -d '{"action":"approveAll"}' --max-time 30 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Approved {d[\"data\"][\"approved\"]}')"

# Step 3: Register bidder with full org
echo ">>> Step 3: Registering bidder..."
rm -f /tmp/cookies2.txt
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -c /tmp/cookies2.txt \
  -d '{
    "name": "Vikram Mehta",
    "email": "testcompliant@example.com",
    "password": "Test@12345",
    "organization": {
      "legalName": "Vikram Engineering Solutions Pvt Ltd",
      "tradeName": "VESPL",
      "phone": "9876543210",
      "pan": "VESPL1234A",
      "gstin": "27VESPL1234A1Z5",
      "udyamNumber": "UDYAM-MH-02-0005678",
      "registeredAddress": "456 MIDC Industrial Area, Pune - 411018",
      "state": "Maharashtra",
      "city": "Pune",
      "organizationType": "PRIVATE_LIMITED",
      "businessCategory": "MANUFACTURER",
      "isMsme": true,
      "isStartup": false,
      "annualTurnoverLakh": 950
    }
  }' --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  User: {d[\"data\"][\"userId\"]}')"

# Step 4: Create bid
echo ">>> Step 4: Creating bid..."
BID_RESPONSE=$(curl -s -X POST http://localhost:3000/api/bids \
  -H "Content-Type: application/json" -b /tmp/cookies2.txt \
  -d "{\"tenderId\":\"$TENDER_ID\"}" --max-time 30)
BID_ID=$(echo "$BID_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['bidId'])")
echo "  Bid: $BID_ID"

# Step 5: Create ALL documents that PASS every requirement
echo ">>> Step 5: Uploading compliant documents..."

cat > /tmp/c_gst.txt << 'EOF'
GOVERNMENT OF INDIA - GST REGISTRATION CERTIFICATE
GSTIN: 27VESPL1234A1Z5
Legal Name: Vikram Engineering Solutions Pvt Ltd
Trade Name: VESPL
Status: ACTIVE
Registration Date: 2017-07-01
State: Maharashtra (27)
Address: 456 MIDC Industrial Area, Pune - 411018
EOF

cat > /tmp/c_pan.txt << 'EOF'
INCOME TAX DEPARTMENT - PAN CARD
Permanent Account Number: VESPL1234A
Name: VIKRAM ENGINEERING SOLUTIONS PVT LTD
Status: Active
Date of Incorporation: 2016-03-10
EOF

cat > /tmp/c_udyam.txt << 'EOF'
UDYAM REGISTRATION - MINISTRY OF MSME
Udyam Registration Number: UDYAM-MH-02-0005678
Enterprise Name: Vikram Engineering Solutions Pvt Ltd
Enterprise Type: Small Enterprise
Status: Active
Date of Registration: 2017-09-15
Valid Upto: LIFETIME
EOF

cat > /tmp/c_oem.txt << 'EOF'
OEM AUTHORIZATION LETTER
From: Kirloskar Brothers Ltd
To: Vikram Engineering Solutions Pvt Ltd
Product Category: Industrial Centrifugal Pumps
Authorization Date: 2024-06-01
Valid Till: 2027-05-31
Signatory: R. Sharma, Director Sales
EOF

cat > /tmp/c_turnover.txt << 'EOF'
CHARTERED ACCOUNTANT CERTIFICATE - TURNOVER
Certified that M/s Vikram Engineering Solutions Pvt Ltd has:
FY 2023-24: Rs 950,00,000 (950.00 Lakh)
FY 2022-23: Rs 920,00,000 (920.00 Lakh)
FY 2021-22: Rs 890,00,000 (890.00 Lakh)
Average Annual Turnover: Rs 920,00,000 (920.00 Lakh)
Certified By: M/s Deloitte Haskins & Sells, Chartered Accountants
Date: 2025-09-15
EOF

cat > /tmp/c_experience.txt << 'EOF'
EXPERIENCE CERTIFICATE
Purchaser: Indian Oil Corporation Ltd
Work Description: Supply, installation and commissioning of industrial centrifugal pumps
Value: Rs 4,50,00,000
From Date: 2019-04-01
To Date: 2025-06-30
Duration: 6 years
EOF

cat > /tmp/c_local.txt << 'EOF'
LOCAL CONTENT DECLARATION - MAKE IN INDIA
Under Make in India Order (PPP-MII 2017)
Product: Industrial Centrifugal Pumps
Local Content Percentage: 68 percent
Declared On: 2025-09-10
Signatory: Vikram Mehta, Director
EOF

cat > /tmp/c_iso.txt << 'EOF'
ISO 9001:2015 CERTIFICATE
Certificate Name: ISO 9001:2015 Quality Management System
Issuer: Bureau of Indian Standards
Organization: Vikram Engineering Solutions Pvt Ltd
Valid From: 2023-07-01
Valid Till: 2026-06-30
EOF

cat > /tmp/c_company.txt << 'EOF'
CERTIFICATE OF INCORPORATION
Company Name: Vikram Engineering Solutions Pvt Ltd
CIN: U29300MH2016PTC275678
Date of Incorporation: 2016-03-10
Registered Office: 456 MIDC Industrial Area, Pune - 411018
EOF

for DOC_INFO in "GST_CERTIFICATE:c_gst.txt" "PAN_CARD:c_pan.txt" "UDYAM_CERTIFICATE:c_udyam.txt" "OEM_AUTHORIZATION:c_oem.txt" "TURNOVER_PROOF:c_turnover.txt" "EXPERIENCE_CERTIFICATE:c_experience.txt" "LOCAL_CONTENT_DECLARATION:c_local.txt" "COMPANY_CERTIFICATE:c_iso.txt" "COMPANY_CERTIFICATE:c_company.txt"; do
  TYPE="${DOC_INFO%%:*}"
  FILE="${DOC_INFO##*:}"
  STATUS=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
    -b /tmp/cookies2.txt -F "docType=$TYPE" -F "files=@/tmp/$FILE" --max-time 60 | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['documents'][0]['status'])" 2>/dev/null || echo "ERROR")
  echo "  $TYPE → $STATUS"
done

# Step 6: Submit
echo ">>> Step 6: Submitting bid..."
curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/submit" \
  -b /tmp/cookies2.txt --max-time 30 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Submitted: {d[\"data\"][\"bidNumber\"]}')"

# Check submitted notification
echo "  📬 Bid submitted notification:"
curl -s http://localhost:3000/api/notifications -b /tmp/cookies2.txt --max-time 15 | \
  python3 -c "
import sys,json
d=json.load(sys.stdin)
n=d['data']['notifications'][0]
print(f'  [{n[\"kind\"]}] {n[\"title\"]}')
for line in n['body'].split(chr(10))[:8]:
    print(f'    {line}')
"

# Step 7: Verify
echo ""
echo ">>> Step 7: Running verification..."
VERIFY=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/verify" \
  -H "Content-Type: application/json" --max-time 120)
echo "$VERIFY" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f'  ══════════════════════════════════')
print(f'  COMPLIANCE SCORE: {d[\"complianceScore\"]}/100')
print(f'  RISK LEVEL: {d[\"riskLevel\"]}')
print(f'  ══════════════════════════════════')
for r in d['results']:
    icon = '✅' if r['result']=='PASS' else '❌' if r['result']=='FAIL' else '⚠️' if r['result']=='REVIEW' else '🔲'
    print(f'  {icon} {r[\"code\"]}: {r[\"result\"]}')
print(f'  ══════════════════════════════════')
print(f'  AI: {d[\"recommendationHeadline\"][:120]}')
"
SCORE=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['complianceScore'])" 2>/dev/null)

# Step 8: Decision
echo ""
echo ">>> Step 8: Officer decision..."
if [ "$SCORE" -ge 70 ]; then
  echo "  Score $SCORE >= 70 → COMPLIANT ✅"
  curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
    -H "Content-Type: application/json" \
    -d "{\"decision\":\"COMPLIANT\",\"notes\":\"All requirements verified. Score $SCORE/100 exceeds threshold. Bidder qualifies for technical evaluation. Documents are genuine and compliant.\"}" --max-time 30 | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"data\"][\"decision\"]}')"
else
  echo "  Score $SCORE < 70 → NON_COMPLIANT ❌"
  curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
    -H "Content-Type: application/json" \
    -d "{\"decision\":\"NON_COMPLIANT\",\"notes\":\"Score $SCORE/100 below threshold.\"}" --max-time 30 | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"data\"][\"decision\"]}')"
fi

# Step 9: All notifications
echo ""
echo ">>> Step 9: All bidder notifications:"
curl -s http://localhost:3000/api/notifications -b /tmp/cookies2.txt --max-time 15 | \
  python3 -c "
import sys,json
d=json.load(sys.stdin)
notifs=d['data']['notifications']
print(f'  Total: {len(notifs)} | Unread: {d[\"data\"][\"unread\"]}')
print()
for n in notifs:
    print(f'  [{n[\"kind\"]}] {n[\"title\"]}')
    for line in n['body'].split(chr(10))[:15]:
        print(f'    {line}')
    print()
"

echo "=========================================="
echo "  COMPLIANT FLOW TEST COMPLETE"
echo "=========================================="
