---
source: GST Common Portal / CBIC guidance summaries
official_domain: gst.gov.in
document_title: GST Registration and GSTIN Verification
publication_date: ""
effective_date: ""
jurisdiction: India
tier: 1
retrieved_at: 2026-08
---

# GSTIN structure and verification

A GSTIN is a 15-character identifier: two digits of state code, ten characters forming the PAN of the entity, one digit entity-count suffix per state, the letter Z by default, and a final mod-36 checksum character computed over the first fourteen characters.

The official GST Common Portal provides a "Search Taxpayer" facility where a GSTIN can be entered to confirm registration status, legal name and filing regularity. Programmatic verification of third-party GSTINs requires authorized GSP/ASP access under GSTN agreements; unauthenticated bulk API access is not provided publicly.

## Verification procedure without API access

Enter the GSTIN on the official Search Taxpayer page, compare legal name and trade name against bid documents, record status (Active/Suspended/Cancelled) and last filing date as evidence. Capture a screenshot or signed note into the audit file.

## Known limitations

Name variants due to formatting are normal. A cancelled-but-reviving status may appear temporarily. The checksum only validates transcription accuracy, not registration genuineness.
