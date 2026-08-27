#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  FULL E2E TEST: All Document Types"
echo "=========================================="

# Step 1: Create tender
echo ""
echo ">>> Step 1: Creating tender..."
TENDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenders \
  -F "title=Supply of Industrial Centrifugal Pumps for Water Distribution" \
  -F "tenderNumber=FULL/TEST/2026/001" \
  -F "buyerOrganization=Chennai Petroleum Corporation Ltd" \
  -F "category=Industrial Pumps" \
  -F "state=Tamil Nadu" \
  -F "city=Chennai" \
  -F "closingDate=2026-12-31" \
  -F "estimatedValueLakh=2500" \
  -F "runAi=true" \
  -F "tenderText=EMD Amount: Rs 50,00,000. Mandatory Requirements: 1. GST Registration Certificate with valid GSTIN. 2. PAN Card of the company. 3. Udyam/MSME Registration Certificate. 4. OEM Authorization Letter from manufacturer. 5. Minimum annual turnover of Rs 500 Lakh for last 3 years. 6. Experience of at least 5 years in supply of industrial pumps. 7. Local content declaration with minimum 40 percent Make in India. 8. ISO 9001:2015 certification. 9. EPFO and ESIC compliance certificates. Optional: Startup India recognition. Company registration certificate required." \
  --max-time 120 2>&1)
echo "$TENDER_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Tender created: {d[\"data\"][\"tenderNumber\"]} with {d[\"data\"][\"requirementCount\"]} requirements')" 2>/dev/null || echo "$TENDER_RESPONSE"

TENDER_ID=$(echo "$TENDER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tenderId'])" 2>/dev/null)
echo "  Tender ID: $TENDER_ID"

# Step 2: Approve all requirements
echo ""
echo ">>> Step 2: Approving requirements..."
curl -s -X POST "http://localhost:3000/api/tenders/$TENDER_ID/requirements" \
  -H "Content-Type: application/json" \
  -d '{"action":"approveAll"}' --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Approved: {d[\"data\"][\"approved\"]} requirements, frozen: {d[\"data\"][\"frozen\"]}')"

# Step 3: Register bidder
echo ""
echo ">>> Step 3: Registering bidder..."
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -d '{
    "name": "Rajesh Kumar",
    "email": "rajesh.kumar@testindustries.example",
    "password": "Test@12345",
    "organization": {
      "legalName": "Rajesh Industrial Solutions Pvt Ltd",
      "tradeName": "RISPL",
      "phone": "9876543210",
      "pan": "ABCRS1234A",
      "gstin": "27ABCRS1234A1Z5",
      "udyamNumber": "UDYAM-MH-01-0001234",
      "registeredAddress": "123 Industrial Area, Andheri East, Mumbai - 400069",
      "state": "Maharashtra",
      "city": "Mumbai",
      "organizationType": "PRIVATE_LIMITED",
      "businessCategory": "MANUFACTURER",
      "isMsme": true,
      "isStartup": false,
      "annualTurnoverLakh": 850
    }
  }' --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  User: {d[\"data\"][\"userId\"]} role: {d[\"data\"][\"role\"]}')" 2>/dev/null || echo "  Registration may have failed (user might exist)"

# Step 4: Create bid
echo ""
echo ">>> Step 4: Creating bid..."
BID_RESPONSE=$(curl -s -X POST http://localhost:3000/api/bids \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d "{\"tenderId\":\"$TENDER_ID\"}" --max-time 30)
echo "$BID_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Bid: {d[\"data\"][\"bidId\"]}')"
BID_ID=$(echo "$BID_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['bidId'])" 2>/dev/null)

# Step 5: Create ALL document types
echo ""
echo ">>> Step 5: Uploading ALL document types..."

cat > /tmp/gst_cert.txt << 'EOF'
GOVERNMENT OF INDIA - GST REGISTRATION CERTIFICATE
GSTIN: 27ABCRS1234A1Z5
Legal Name: Rajesh Industrial Solutions Pvt Ltd
Trade Name: RISPL
Status: ACTIVE
Registration Date: 2019-04-15
State: Maharashtra (27)
Address: 123 Industrial Area, Andheri East, Mumbai - 400069
EOF

cat > /tmp/pan_card.txt << 'EOF'
INCOME TAX DEPARTMENT - PAN CARD
Permanent Account Number: ABCRS1234A
Name: RAJESH INDUSTRIAL SOLUTIONS PVT LTD
Status: Active
Date of Birth/Incorporation: 2018-01-15
EOF

cat > /tmp/udyam_cert.txt << 'EOF'
UDYAM REGISTRATION - MINISTRY OF MSME
Udyam Registration Number: UDYAM-MH-01-0001234
Enterprise Name: Rajesh Industrial Solutions Pvt Ltd
Enterprise Type: Small Enterprise
Status: Active
Date of Registration: 2020-08-20
Valid Upto: LIFETIME
EOF

cat > /tmp/oem_auth.txt << 'EOF'
OEM AUTHORIZATION LETTER
From: Kirloskar Brothers Ltd
To: Rajesh Industrial Solutions Pvt Ltd
Product Category: Industrial Centrifugal Pumps
Authorization Date: 2025-01-15
Valid Till: 2027-01-14
Signatory: R. Sharma, Authorized Signatory
This letter authorizes the above company to market and supply our industrial centrifugal pumps.
EOF

cat > /tmp/turnover_proof.txt << 'EOF'
CHARTERED ACCOUNTANT - TURNOVER CERTIFICATE
Certified that M/s Rajesh Industrial Solutions Pvt Ltd has:
FY 2023-24: Rs 875,00,000 (875.00 Lakh)
FY 2022-23: Rs 820,00,000 (820.00 Lakh)
FY 2021-22: Rs 795,00,000 (795.00 Lakh)
Average Annual Turnover: Rs 830,00,000 (830.00 Lakh)
Certified By: M/s Sharma & Associates, Chartered Accountants
EOF

cat > /tmp/experience_cert.txt << 'EOF'
EXPERIENCE CERTIFICATE
Purchaser: Indian Oil Corporation Ltd
Work Description: Supply, installation and commissioning of industrial centrifugal pumps
Value: Rs 3,50,00,000
From Date: 2020-06-15
To Date: 2025-03-20
Duration: 4.75 years
EOF

cat > /tmp/local_content.txt << 'EOF'
LOCAL CONTENT DECLARATION
Under Make in India Order (PPP-MII 2017)
Product: Industrial Centrifugal Pumps
Local Content: 65 percent
Declared On: 2025-09-10
Signatory: Rajesh Kumar, Director
EOF

cat > /tmp/iso_cert.txt << 'EOF'
ISO 9001:2015 CERTIFICATE
Certificate Name: ISO 9001:2015 Quality Management System
Issuer: Bureau of Indian Standards
Organization: Rajesh Industrial Solutions Pvt Ltd
Valid From: 2023-07-01
Valid Till: 2026-06-30
EOF

cat > /tmp/company_cert.txt << 'EOF'
CERTIFICATE OF INCORPORATION
Company Name: Rajesh Industrial Solutions Pvt Ltd
CIN: U29300MH2018PTC123456
Date of Incorporation: 2018-01-15
Registered Office: 123 Industrial Area, Andheri East, Mumbai - 400069
EOF

# Upload all documents
for DOC_INFO in "GST_CERTIFICATE:gst_cert.txt" "PAN_CARD:pan_card.txt" "UDYAM_CERTIFICATE:udyam_cert.txt" "OEM_AUTHORIZATION:oem_auth.txt" "TURNOVER_PROOF:turnover_proof.txt" "EXPERIENCE_CERTIFICATE:experience_cert.txt" "LOCAL_CONTENT_DECLARATION:local_content.txt" "COMPANY_CERTIFICATE:iso_cert.txt" "COMPANY_CERTIFICATE:company_cert.txt"; do
  TYPE="${DOC_INFO%%:*}"
  FILE="${DOC_INFO##*:}"
  echo "  Uploading $TYPE ($FILE)..."
  RESULT=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
    -b /tmp/cookies.txt \
    -F "docType=$TYPE" \
    -F "files=@/tmp/$FILE" \
    --max-time 60)
  STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['documents'][0]['status'])" 2>/dev/null || echo "ERROR")
  echo "    → $STATUS"
done

# Step 6: Submit bid
echo ""
echo ">>> Step 6: Submitting bid..."
curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/submit" \
  -b /tmp/cookies.txt --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Submitted: {d[\"data\"][\"bidNumber\"]}')"

# Check bid submitted notification
echo ""
echo ">>> Checking bid submitted notification..."
curl -s http://localhost:3000/api/notifications \
  -b /tmp/cookies.txt --max-time 15 | python3 -c "
import sys,json
d=json.load(sys.stdin)
n=d['data']['notifications'][0]
print(f'  [{n[\"kind\"]}] {n[\"title\"]}')
print(f'  {n[\"body\"][:300]}...')
"

# Step 7: Run verification
echo ""
echo ">>> Step 7: Running verification..."
VERIFY=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/verify" \
  -H "Content-Type: application/json" --max-time 120)
echo "$VERIFY" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f'  Compliance Score: {d[\"complianceScore\"]}/100')
print(f'  Risk Level: {d[\"riskLevel\"]}')
print(f'  Results:')
for r in d['results']:
    icon = '✅' if r['result']=='PASS' else '❌' if r['result']=='FAIL' else '⚠️' if r['result']=='REVIEW' else '🔲'
    print(f'    {icon} {r[\"code\"]}: {r[\"result\"]}')
print(f'  Recommendation: {d[\"recommendationHeadline\"][:120]}')
"

SCORE=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['complianceScore'])" 2>/dev/null)

# Step 8: Check verification notification
echo ""
echo ">>> Verification notification:"
curl -s http://localhost:3000/api/notifications \
  -b /tmp/cookies.txt --max-time 15 | python3 -c "
import sys,json
d=json.load(sys.stdin)
notifs=d['data']['notifications']
for n in notifs[:2]:
    print(f'  [{n[\"kind\"]}] {n[\"title\"]}')
    body = n['body']
    for line in body.split(chr(10))[:15]:
        print(f'    {line}')
    print()
"

# Step 9: Officer decision
echo ">>> Step 9: Officer decision..."
if [ "$SCORE" -ge 70 ]; then
  echo "  Score $SCORE >= 70 → COMPLIANT (Pass)"
  curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
    -H "Content-Type: application/json" \
    -d "{\"decision\":\"COMPLIANT\",\"notes\":\"All requirements met. Score $SCORE/100 exceeds threshold. Bidder qualifies.\"}" --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"data\"][\"decision\"]}')"
else
  echo "  Score $SCORE < 70 → NON_COMPLIANT (Fail)"
  curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
    -H "Content-Type: application/json" \
    -d "{\"decision\":\"NON_COMPLIANT\",\"notes\":\"Compliance score $SCORE/100 is below the 70 threshold. Multiple mandatory requirements not met.\"}" --max-time 30 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Decision: {d[\"data\"][\"decision\"]}')"
fi

# Step 10: Final notification check
echo ""
echo ">>> Final notifications:"
curl -s http://localhost:3000/api/notifications \
  -b /tmp/cookies.txt --max-time 15 | python3 -c "
import sys,json
d=json.load(sys.stdin)
notifs=d['data']['notifications']
print(f'  Total: {len(notifs)} | Unread: {d[\"data\"][\"unread\"]}')
for n in notifs[:3]:
    print(f'  [{n[\"kind\"]}] {n[\"title\"]}')
    body = n['body']
    for line in body.split(chr(10))[:12]:
        print(f'    {line}')
    print()
"

echo "=========================================="
echo "  FULL E2E TEST COMPLETE"
echo "=========================================="
