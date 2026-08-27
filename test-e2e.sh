#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  E2E TEST: Full Bid Compliance Flow"
echo "=========================================="

# Step 1: Create a tender via API
echo ""
echo ">>> Step 1: Creating tender..."
TENDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenders \
  -F "title=Supply of Industrial Centrifugal Pumps for Water Distribution" \
  -F "tenderNumber=E2E/TEST/2026/001" \
  -F "buyerOrganization=Chennai Petroleum Corporation Ltd" \
  -F "category=Industrial Pumps" \
  -F "state=Tamil Nadu" \
  -F "city=Chennai" \
  -F "closingDate=2026-12-31" \
  -F "estimatedValueLakh=2500" \
  -F "runAi=true" \
  -F "tenderText=EMD Amount: Rs 50,00,000. Mandatory Requirements: 1. GST Registration Certificate with valid GSTIN. 2. PAN Card of the company. 3. Udyam/MSME Registration Certificate. 4. OEM Authorization Letter from manufacturer. 5. Minimum annual turnover of Rs 500 Lakh for last 3 years. 6. Experience of at least 5 years in supply of industrial pumps. 7. Local content declaration with minimum 40 percent Make in India content. 8. ISO 9001:2015 quality management certification. 9. BIS/ISI certification for the product. 10. EPFO/ESIC compliance certificates. Optional: Startup India recognition. Company registration certificate required." \
  --max-time 120 2>&1)
echo "$TENDER_RESPONSE"

# Extract tender ID
TENDER_ID=$(echo "$TENDER_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tenderId',''))" 2>/dev/null || echo "")
if [ -z "$TENDER_ID" ]; then
  echo "FAILED: Could not create tender"
  exit 1
fi
echo "Tender ID: $TENDER_ID"

# Step 2: Approve all requirements
echo ""
echo ">>> Step 2: Approving all requirements..."
APPROVE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/tenders/$TENDER_ID/requirements" \
  -H "Content-Type: application/json" \
  -d '{"action":"approveAll"}' \
  --max-time 30 2>&1)
echo "$APPROVE_RESPONSE"

# Step 3: Register a bidder
echo ""
echo ">>> Step 3: Registering bidder user..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rajesh Kumar",
    "email": "rajesh.kumar@testindustries.example",
    "password": "Test@12345",
    "phone": "9876543210",
    "aadharNumber": "123456789012"
  }' \
  --max-time 30 2>&1)
echo "$REGISTER_RESPONSE"

# Extract session cookie
COOKIE=$(echo "$REGISTER_RESPONSE" | python3 -c "
import sys, json, http.cookiejar
# Extract Set-Cookie from the raw response
import re
" 2>/dev/null)

# We need to capture cookie from curl headers
REGISTER_RAW=$(curl -s -D- -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
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
  }' \
  -c /tmp/cookies.txt \
  --max-time 30 2>&1)
echo "$REGISTER_RAW" | head -20

echo "\n>>> Step 4: Organization already created with registration."

# Step 5: Create bid for tender
echo ""
echo ">>> Step 5: Creating bid..."
BID_RESPONSE=$(curl -s -X POST http://localhost:3000/api/bids \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d "{\"tenderId\":\"$TENDER_ID\"}" \
  --max-time 30 2>&1)
echo "$BID_RESPONSE"

BID_ID=$(echo "$BID_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('bidId',''))" 2>/dev/null || echo "")
if [ -z "$BID_ID" ]; then
  echo "FAILED: Could not create bid"
  exit 1
fi
echo "Bid ID: $BID_ID"

# Step 6: Upload documents
echo ""
echo ">>> Step 6: Creating test documents..."

# Create a dummy GST certificate text file
cat > /tmp/gst_cert.txt << 'DOCEOF'
GOVERNMENT OF INDIA
GST REGISTRATION CERTIFICATE
----------------------------------------------
GSTIN: 27ABCRS1234A1Z5
Legal Name: Rajesh Industrial Solutions Pvt Ltd
Trade Name: RISPL
Status: ACTIVE
Registration Date: 2019-04-15
State: Maharashtra (27)
Address: 123 Industrial Area, Andheri East, Mumbai - 400069
Date of Issue: 2019-04-15
Signatory: Rajesh Kumar, Director
----------------------------------------------
This certificate is issued under Section 22 of the CGST Act, 2017.
DOCEOF

# Create a dummy PAN card text file
cat > /tmp/pan_card.txt << 'DOCEOF'
INCOME TAX DEPARTMENT - GOVERNMENT OF INDIA
PAN CARD
----------------------------------------------
Permanent Account Number: ABCRS1234A
Name: RAJESH INDUSTRIAL SOLUTIONS PVT LTD
Date of Issue: 2018-06-10
Status: Active
Father/Partner Name: N/A
Date of Birth/Incorporation: 2018-01-15
----------------------------------------------
DOCEOF

# Create a dummy Udyam certificate text file
cat > /tmp/udyam_cert.txt << 'DOCEOF'
UDYAM REGISTRATION CERTIFICATE
MINISTRY OF MICRO, SMALL AND MEDIUM ENTERPRISES
----------------------------------------------
Udyam Registration Number: UDYAM-MH-01-0001234
Enterprise Name: Rajesh Industrial Solutions Pvt Ltd
Enterprise Type: Small Enterprise
Status: Active
Date of Registration: 2020-08-20
Valid Upto: LIFETIME
NIC Code: 2812
----------------------------------------------
DOCEOF

# Create a dummy turnover proof
cat > /tmp/turnover_proof.txt << 'DOCEOF'
CHARTERED ACCOUNTANT CERTIFICATE
AUDITED FINANCIAL STATEMENTS - TURNOVER CERTIFICATE
----------------------------------------------
Certified that M/s Rajesh Industrial Solutions Pvt Ltd
has the following annual turnover:
FY 2023-24: Rs 875,00,000 (875.00 Lakh)
FY 2022-23: Rs 820,00,000 (820.00 Lakh)
FY 2021-22: Rs 795,00,000 (795.00 Lakh)
Average Annual Turnover: Rs 830,00,000 (830.00 Lakh)
Certified By: M/s Sharma & Associates, Chartered Accountants
Date: 2025-09-15
----------------------------------------------
DOCEOF

echo "Uploading GST Certificate..."
GST_UPLOAD=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
  -b /tmp/cookies.txt \
  -F "docType=GST_CERTIFICATE" \
  -F "files=@/tmp/gst_cert.txt" \
  --max-time 60 2>&1)
echo "$GST_UPLOAD"

echo "Uploading PAN Card..."
PAN_UPLOAD=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
  -b /tmp/cookies.txt \
  -F "docType=PAN_CARD" \
  -F "files=@/tmp/pan_card.txt" \
  --max-time 60 2>&1)
echo "$PAN_UPLOAD"

echo "Uploading Udyam Certificate..."
UDYAM_UPLOAD=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
  -b /tmp/cookies.txt \
  -F "docType=UDYAM_CERTIFICATE" \
  -F "files=@/tmp/udyam_cert.txt" \
  --max-time 60 2>&1)
echo "$UDYAM_UPLOAD"

echo "Uploading Turnover Proof..."
TURNOVER_UPLOAD=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/documents" \
  -b /tmp/cookies.txt \
  -F "docType=TURNOVER_PROOF" \
  -F "files=@/tmp/turnover_proof.txt" \
  --max-time 60 2>&1)
echo "$TURNOVER_UPLOAD"

# Step 7: Submit bid
echo ""
echo ">>> Step 7: Submitting bid..."
SUBMIT_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/submit" \
  -b /tmp/cookies.txt \
  --max-time 30 2>&1)
echo "$SUBMIT_RESPONSE"

# Step 8: Run verification
echo ""
echo ">>> Step 8: Running verification pipeline..."
VERIFY_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/verify" \
  -H "Content-Type: application/json" \
  --max-time 120 2>&1)
echo "$VERIFY_RESPONSE"

# Step 9: Check compliance score
SCORE=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('complianceScore','N/A'))" 2>/dev/null || echo "N/A")
RISK=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('riskLevel','N/A'))" 2>/dev/null || echo "N/A")
echo ""
echo "=========================================="
echo "  VERIFICATION RESULTS"
echo "=========================================="
echo "  Compliance Score: $SCORE / 100"
echo "  Risk Level: $RISK"

# Step 10: Officer decision based on score
echo ""
if [ "$SCORE" != "N/A" ] && [ "$SCORE" != "" ]; then
  SCORE_INT=$(echo "$SCORE" | python3 -c "import sys; print(int(float(sys.stdin.read().strip())))" 2>/dev/null || echo "0")
  if [ "$SCORE_INT" -ge 70 ]; then
    echo ">>> Step 9: Officer Decision → COMPLIANT (Pass)"
    DECISION=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
      -H "Content-Type: application/json" \
      -d '{"decision":"COMPLIANT","notes":"All mandatory requirements met. Score above threshold. Bidder qualifies for technical evaluation."}' \
      --max-time 30 2>&1)
  else
    echo ">>> Step 9: Officer Decision → NON_COMPLIANT (Fail - Score below 70)"
    DECISION=$(curl -s -X POST "http://localhost:3000/api/bids/$BID_ID/decision" \
      -H "Content-Type: application/json" \
      -d '{"decision":"NON_COMPLIANT","notes":"Compliance score below threshold. Multiple mandatory requirements not met. Bidder does not qualify."}' \
      --max-time 30 2>&1)
  fi
  echo "$DECISION"
else
  echo ">>> Step 9: No score computed - cannot make decision"
fi

# Step 11: Check notifications
echo ""
echo ">>> Step 10: Checking bidder notifications..."
NOTIF_RESPONSE=$(curl -s http://localhost:3000/api/notifications \
  -b /tmp/cookies.txt \
  --max-time 15 2>&1)
echo "$NOTIF_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d.get('ok'):
        notifs = d['data']['notifications']
        unread = d['data']['unread']
        print(f'  Total notifications: {len(notifs)}')
        print(f'  Unread: {unread}')
        for n in notifs[:5]:
            print(f'  [{n[\"kind\"]}] {n[\"title\"]}: {n[\"body\"][:100]}')
    else:
        print('  Failed to load notifications')
except:
    print('  Could not parse notification response')
" 2>/dev/null

echo ""
echo "=========================================="
echo "  E2E TEST COMPLETE"
echo "=========================================="
