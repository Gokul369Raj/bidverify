import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BidVerify AI database...");

  // ── Clear existing data (order matters for FK constraints) ──
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.aiRun.deleteMany();
  await prisma.riskScore.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.complianceResult.deleteMany();
  await prisma.verificationResult.deleteMany();
  await prisma.extractedField.deleteMany();
  await prisma.bidDocument.deleteMany();
  await prisma.bidSubmission.deleteMany();
  await prisma.corrigendum.deleteMany();
  await prisma.savedTender.deleteMany();
  await prisma.tenderRequirement.deleteMany();
  await prisma.tenderDocument.deleteMany();
  await prisma.complianceRuleHistory.deleteMany();
  await prisma.complianceRule.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.mockRegistry.deleteMany();
  await prisma.apiIntegration.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ── Officers ──
  const passwordHash = await bcrypt.hash("password123", 10);

  const officerUser = await prisma.user.create({
    data: {
      email: "rajesh.verma@procurement.gov.in",
      name: "Rajesh Verma",
      phone: "9876543210",
      aadharNumber: "1234-5678-9012",
      passwordHash,
      role: "PROCUREMENT_OFFICER",
      emailVerifiedAt: new Date(),
      loginCount: 47,
      lastLoginAt: new Date(),
    },
  });

  const evaluatorUser = await prisma.user.create({
    data: {
      email: "priya.singh@procurement.gov.in",
      name: "Priya Singh",
      phone: "9876543211",
      aadharNumber: "2345-6789-0123",
      passwordHash,
      role: "BID_EVALUATION_OFFICER",
      emailVerifiedAt: new Date(),
      loginCount: 32,
      lastLoginAt: new Date(),
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@bidverify.ai",
      name: "System Admin",
      phone: "9876543212",
      aadharNumber: "3456-7890-1234",
      passwordHash,
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      loginCount: 89,
      lastLoginAt: new Date(),
    },
  });

  const auditorUser = await prisma.user.create({
    data: {
      email: "auditor@procurement.gov.in",
      name: "Amit Joshi",
      phone: "9876543213",
      aadharNumber: "4567-8901-2345",
      passwordHash,
      role: "AUDITOR",
      emailVerifiedAt: new Date(),
      loginCount: 15,
      lastLoginAt: new Date(),
    },
  });

  const reviewerUser = await prisma.user.create({
    data: {
      email: "compliance@procurement.gov.in",
      name: "Compliance Team",
      phone: "9876543214",
      aadharNumber: "5678-9012-3456",
      passwordHash,
      role: "COMPLIANCE_REVIEWER",
      emailVerifiedAt: new Date(),
      loginCount: 22,
      lastLoginAt: new Date(),
    },
  });

  console.log("✅ Officers created");

  // ── Organizations (15 bidders) ──
  const orgData = [
    {
      legalName: "ABC Industries Private Limited",
      tradeName: "ABC Industries",
      pan: "ABCPM1234F",
      gstin: "27ABCPM1234F1Z5",
      udyamNumber: "UDYAM-MH-01-0012345",
      cin: "U27100MH2015PTC362847",
      registeredAddress: "Plot 42, MIDC, Ambarnath, Maharashtra 421501",
      state: "Maharashtra",
      city: "Mumbai",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      annualTurnoverLakh: 1200,
      incorporationDate: new Date("2015-06-15"),
    },
    {
      legalName: "XYZ Engineering Solutions Ltd",
      tradeName: "XYZ Engineering",
      pan: "XYZES5678G",
      gstin: "09XYZES5678G1Z3",
      udyamNumber: "UDYAM-UP-02-0056789",
      registeredAddress: "Sector 62, Noida, Uttar Pradesh 201301",
      state: "Uttar Pradesh",
      city: "Noida",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "SERVICE_PROVIDER",
      isMsme: false,
      annualTurnoverLakh: 4500,
      incorporationDate: new Date("2010-03-22"),
    },
    {
      legalName: "PQR Systems Private Limited",
      tradeName: "PQR Systems",
      pan: "PQRSY9012H",
      gstin: "29PQRSY9012H1Z1",
      registeredAddress: "HSR Layout, Bengaluru, Karnataka 560102",
      state: "Karnataka",
      city: "Bengaluru",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: false,
      annualTurnoverLakh: 8500,
      incorporationDate: new Date("2008-11-10"),
    },
    {
      legalName: "Vikram Pump & Motor Co.",
      tradeName: "Vikram Pumps",
      pan: "VIKPM3456A",
      gstin: "23VIKPM3456A1Z9",
      udyamNumber: "UDYAM-MP-03-0034567",
      registeredAddress: "Industrial Area, Pithampur, Madhya Pradesh 454775",
      state: "Madhya Pradesh",
      city: "Indore",
      organizationType: "PARTNERSHIP",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      annualTurnoverLakh: 650,
      incorporationDate: new Date("2012-08-05"),
    },
    {
      legalName: "Gupta Steel & Alloys Pvt Ltd",
      tradeName: "Gupta Steel",
      pan: "GUPTS7890B",
      gstin: "07GUPTS7890B1Z6",
      registeredAddress: "Okhla Industrial Area, New Delhi 110020",
      state: "Delhi",
      city: "New Delhi",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "TRADER",
      isMsme: false,
      annualTurnoverLakh: 3200,
      incorporationDate: new Date("2011-01-18"),
    },
    {
      legalName: "Sunrise Renewable Energy Pvt Ltd",
      tradeName: "Sunrise Solar",
      pan: "SUNRE1234C",
      gstin: "24SUNRE1234C1Z2",
      udyamNumber: "UDYAM-GJ-04-0012345",
      registeredAddress: "SG Highway, Ahmedabad, Gujarat 380015",
      state: "Gujarat",
      city: "Ahmedabad",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      isStartup: true,
      annualTurnoverLakh: 380,
      incorporationDate: new Date("2021-04-10"),
    },
    {
      legalName: "Bharat Infrastructure Corp",
      tradeName: "Bharat Infra",
      pan: "BHAIN5678D",
      gstin: "33BHAIN5678D1Z8",
      registeredAddress: "Guindy, Chennai, Tamil Nadu 600032",
      state: "Tamil Nadu",
      city: "Chennai",
      organizationType: "PUBLIC_LIMITED",
      businessCategory: "SERVICE_PROVIDER",
      isMsme: false,
      annualTurnoverLakh: 12000,
      incorporationDate: new Date("2005-09-20"),
    },
    {
      legalName: "Deccan Precision Engineering",
      tradeName: "Deccan Precision",
      pan: "DECCP9012E",
      gstin: "36DECCP9012E1Z4",
      udyamNumber: "UDYAM-TS-05-0090123",
      registeredAddress: "HITEC City, Hyderabad, Telangana 500081",
      state: "Telangana",
      city: "Hyderabad",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      annualTurnoverLakh: 900,
      incorporationDate: new Date("2017-02-14"),
    },
    {
      legalName: "Eastern Electronics Pvt Ltd",
      tradeName: "Eastern Electronics",
      pan: "EASTE3456F",
      gstin: "19EASTE3456F1Z7",
      registeredAddress: "Salt Lake, Kolkata, West Bengal 700091",
      state: "West Bengal",
      city: "Kolkata",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: false,
      annualTurnoverLakh: 2800,
      incorporationDate: new Date("2013-07-08"),
    },
    {
      legalName: "Northern Power Solutions",
      tradeName: "NP Solutions",
      pan: "NORPS7890G",
      gstin: "06NORPS7890G1Z1",
      registeredAddress: "Phase 5, Ludhiana, Punjab 141010",
      state: "Punjab",
      city: "Ludhiana",
      organizationType: "PROPRIETORSHIP",
      businessCategory: "TRADER",
      isMsme: true,
      annualTurnoverLakh: 450,
      incorporationDate: new Date("2019-05-25"),
    },
    {
      legalName: "Satellite Defence Systems Pvt Ltd",
      tradeName: "Satellite Defence",
      pan: "SATDS1234H",
      gstin: "11SATDS1234H1Z5",
      registeredAddress: "Cantonment, Pune, Maharashtra 411040",
      state: "Maharashtra",
      city: "Pune",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: false,
      annualTurnoverLakh: 15000,
      incorporationDate: new Date("2003-12-01"),
    },
    {
      legalName: "GreenLeaf Agro Tech Pvt Ltd",
      tradeName: "GreenLeaf",
      pan: "GRELA5678J",
      gstin: "27GRELA5678J1Z3",
      udyamNumber: "UDYAM-MH-06-0056789",
      registeredAddress: "Nashik Road, Nashik, Maharashtra 422101",
      state: "Maharashtra",
      city: "Nashik",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      isStartup: true,
      annualTurnoverLakh: 280,
      incorporationDate: new Date("2022-01-15"),
    },
    {
      legalName: "Karnataka Foundry & Engineering Works",
      tradeName: "Karnataka Foundry",
      pan: "KARFW9012K",
      gstin: "29KARFW9012K1Z9",
      registeredAddress: "Peenya Industrial Area, Bengaluru 560058",
      state: "Karnataka",
      city: "Bengaluru",
      organizationType: "PARTNERSHIP",
      businessCategory: "MANUFACTURER",
      isMsme: true,
      annualTurnoverLakh: 780,
      incorporationDate: new Date("2009-04-12"),
    },
    {
      legalName: "Coastal Shipping & Logistics Pvt Ltd",
      tradeName: "Coastal Logistics",
      pan: "CSHLP3456L",
      gstin: "32CSHLP3456L1Z6",
      registeredAddress: "Ernakulam, Kerala 682011",
      state: "Kerala",
      city: "Kochi",
      organizationType: "PRIVATE_LIMITED",
      businessCategory: "SERVICE_PROVIDER",
      isMsme: false,
      annualTurnoverLakh: 5500,
      incorporationDate: new Date("2014-08-20"),
    },
    {
      legalName: "Rajasthan Mineral Corp Ltd",
      tradeName: "Raj Mineral",
      pan: "RAJMC7890M",
      gstin: "08RAJMC7890M1Z2",
      registeredAddress: "MVIC, Jaipur, Rajasthan 302001",
      state: "Rajasthan",
      city: "Jaipur",
      organizationType: "PUBLIC_LIMITED",
      businessCategory: "TRADER",
      isMsme: false,
      annualTurnoverLakh: 6800,
      incorporationDate: new Date("2007-02-28"),
    },
  ];

  const orgs = [];
  for (const data of orgData) {
    const org = await prisma.organization.create({
      data: {
        ...data,
        fieldStatusJson: JSON.stringify({
          pan: { status: "SELF_DECLARED", source: "SEED" },
          gstin: { status: "SELF_DECLARED", source: "SEED" },
          legalName: { status: "SELF_DECLARED", source: "SEED" },
        }),
      },
    });
    orgs.push(org);
  }

  console.log("✅ 15 organizations created");

  // ── Bidder users ──
  const bidderEmails = [
    "sunil.kumar@abcindustries.example",
    "meena.sharma@xyzengineering.example",
    "rajesh.patel@pqrsystems.example",
    "anita.gupta@vikrampumps.example",
    "vikram.gupta@guptasteel.example",
    "kiran.patel@sunriserenewable.example",
    "ravi.kumar@bharatinfra.example",
    "priya.reddy@deccanprecision.example",
    "sankar.basu@easternelectronics.example",
    "harpreet.singh@npsolutions.example",
    "vikram.rao@satellitedefence.example",
    "sneha.patil@greenleaf.example",
    "mahesh.joshi@karnatakafoundry.example",
    "ramesh.nair@coastalshipping.example",
    "arjun.mehta@rajmineral.example",
  ];

  const bidderPhones = [
    "9800000001", "9800000002", "9800000003", "9800000004", "9800000005",
    "9800000006", "9800000007", "9800000008", "9800000009", "9800000010",
    "9800000011", "9800000012", "9800000013", "9800000014", "9800000015",
  ];
  const bidderAadhars = [
    "6789-0123-4567", "7890-1234-5678", "8901-2345-6789", "9012-3456-7890", "1122-3344-5566",
    "2233-4455-6677", "3344-5566-7788", "4455-6677-8899", "5566-7788-9900", "6677-8899-0011",
    "7788-9900-1122", "8899-0011-2233", "9900-1122-3344", "0011-2233-4455", "1122-4433-5566",
  ];
  const bidderUsers = [];
  for (let i = 0; i < orgs.length; i++) {
    const user = await prisma.user.create({
      data: {
        email: bidderEmails[i],
        name: bidderEmails[i].split("@")[0].split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
        phone: bidderPhones[i],
        aadharNumber: bidderAadhars[i],
        passwordHash,
        role: "BIDDER",
        organizationId: orgs[i].id,
        emailVerifiedAt: new Date(),
        authProvider: i === 0 ? "GOOGLE" : "EMAIL",
        googleId: i === 0 ? "google-demo-123456789" : null,
        loginCount: Math.floor(Math.random() * 30) + 1,
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)),
      },
    });
    bidderUsers.push(user);
  }

  console.log("✅ 15 bidder users created");

  // ── Tenders (5 diverse) ──
  const tenderData = [
    {
      tenderNumber: "CPCL/PUMP/2026/014",
      title: "Supply and Installation of Industrial Centrifugal Pump Sets for CPCL Refinery",
      description: "Procurement of 50 HP centrifugal pump sets including supply, installation, commissioning, and two years comprehensive maintenance for CPCL Chennai Refinery expansion project. The pumps must conform to IS 5126 and be suitable for handling crude oil and refined petroleum products at high temperatures.",
      buyerOrganization: "Chennai Petroleum Corporation Ltd (CPCL)",
      department: "Projects & Engineering",
      category: "Industrial Pumps",
      state: "Tamil Nadu",
      city: "Chennai",
      emdAmount: 500000,
      estimatedValueLakh: 2500,
    },
    {
      tenderNumber: "BHEL/TRN/2026/089",
      title: "Supply of 315 kVA Distribution Transformers (IS 1180 Level-3)",
      description: "Supply of energy-efficient 315 kVA, 11kV/433V, 3-phase, oil-cooled distribution transformers conforming to IS 1180 (Level-3). OEM authorization required from the transformer manufacturer. Supply to BHEL Ramachandrapuram township distribution network. Annual energy efficiency certification required.",
      buyerOrganization: "Bharat Heavy Electricals Ltd (BHEL)",
      department: "Supply Chain Management",
      category: "Electrical Transformers",
      state: "Telangana",
      city: "Hyderabad",
      emdAmount: 750000,
      estimatedValueLakh: 4800,
    },
    {
      tenderNumber: "MPWD/MSME/2026/031",
      title: "MSME-Friendly Supply of Solar Inverters for Rural Electrification",
      description: "Supply of grid-tie solar inverters (50kW-100kW range) for rural electrification projects under Madhya Pradesh state. This tender is reserved for MSME-registered bidders under the MSME Preferential Procurement policy. Startup bidders with DPIIT recognition will receive additional preference. Local content requirement of 40% minimum under Make in India.",
      buyerOrganization: "Madhya Pradesh Power Distribution Co. Ltd",
      department: "Renewable Energy Division",
      category: "Solar Energy Equipment",
      state: "Madhya Pradesh",
      city: "Bhopal",
      estimatedValueLakh: 1800,
    },
    {
      tenderNumber: "BEL/HVAC/2026/055",
      title: "HVAC System for Defence Electronics Manufacturing Facility",
      description: "Design, supply, installation and commissioning of HVAC systems for a new defence electronics manufacturing facility. Requires experience in defence installations, BIS/ISO certifications, and compliance with defence procurement manual. Turnover requirement of minimum ₹10 Crore average over 3 years. OEM authorization from internationally recognized HVAC manufacturer required.",
      buyerOrganization: "Bharat Electronics Ltd (BEL)",
      department: "Capital Projects",
      category: "HVAC Systems",
      state: "Karnataka",
      city: "Bengaluru",
      emdAmount: 1500000,
      estimatedValueLakh: 8500,
    },
    {
      tenderNumber: "WBSEDCL/LT/2026/112",
      title: "Supply of LT Switchgear Panels for Distribution Substations",
      description: "Supply of low-tension switchgear panels (ACB, MCCB, contactors, relays) for 20 distribution substations across West Bengal. Panels must conform to IS 8623. Manufacturer with minimum 3 years experience in switchgear production required. Competitive pricing preferred with technical compliance.",
      buyerOrganization: "West Bengal State Electricity Distribution Co. Ltd",
      department: "Procurement & Stores",
      category: "Electrical Switchgear",
      state: "West Bengal",
      city: "Kolkata",
      estimatedValueLakh: 1200,
    },
  ];

  const tenders = [];
  for (let i = 0; i < tenderData.length; i++) {
    const d = tenderData[i];
    const closingDate = new Date();
    closingDate.setDate(closingDate.getDate() + [14, 21, 7, 30, 10][i]);
    const publishDate = new Date();
    publishDate.setDate(publishDate.getDate() - [10, 15, 5, 20, 8][i]);

    const tender = await prisma.tender.create({
      data: {
        ...d,
        publishDate,
        closingDate,
        source: "MANUAL_IMPORT",
        dataLabel: "DEMO_SIMULATED",
        status: "ACTIVE",
        aiAnalysisStatus: "COMPLETED",
        aiProvider: "heuristic",
        requirementsFrozen: true,
        createdById: officerUser.id,
      },
    });
    tenders.push(tender);
  }

  console.log("✅ 5 tenders created");

  // ── Tender Requirements ──
  const requirementsByTender = [
    // Tender 0: Industrial Pumps
    [
      { code: "R1", type: "GST_REGISTRATION", title: "Active GST registration", description: "Bidder must hold an active GST registration.", mandatory: true, evidenceRequired: true, confidence: 0.92 },
      { code: "R2", type: "PAN", title: "Valid PAN in bidder's name", description: "Bidder must possess a valid PAN.", mandatory: true, evidenceRequired: true, confidence: 0.9 },
      { code: "R3", type: "EXPERIENCE", title: "Minimum 3 years experience in pump supply", description: "Experience in supply of centrifugal pumps.", mandatory: true, evidenceRequired: true, params: { years: 3 }, confidence: 0.85 },
      { code: "R4", type: "TURNOVER", title: "Average annual turnover ≥ ₹50 Lakh", description: "Audited financial statements.", mandatory: true, evidenceRequired: true, params: { minTurnoverLakh: 50 }, confidence: 0.82 },
      { code: "R5", type: "CERTIFICATE", title: "ISO 9001:2015 certification", description: "Valid quality management system certification.", mandatory: true, evidenceRequired: true, params: { certificateName: "ISO 9001:2015" }, confidence: 0.78 },
      { code: "R6", type: "TECHNICAL_SPEC", title: "Pump datasheet conforming to IS 5126", description: "Technical datasheet of offered pump model.", mandatory: true, evidenceRequired: true, confidence: 0.8 },
    ],
    // Tender 1: Transformers
    [
      { code: "R1", type: "GST_REGISTRATION", title: "Active GST registration", description: "Valid GSTIN required.", mandatory: true, evidenceRequired: true, confidence: 0.93 },
      { code: "R2", type: "PAN", title: "Valid PAN", description: "PAN in organization's legal name.", mandatory: true, evidenceRequired: true, confidence: 0.91 },
      { code: "R3", type: "OEM_AUTHORIZATION", title: "OEM Authorization from transformer manufacturer", description: "Must provide OEM authorization letter.", mandatory: true, evidenceRequired: true, confidence: 0.88 },
      { code: "R4", type: "TURNOVER", title: "Average annual turnover ≥ ₹200 Lakh", description: "Audited financial statements for last 3 years.", mandatory: true, evidenceRequired: true, params: { minTurnoverLakh: 200 }, confidence: 0.84 },
      { code: "R5", type: "EXPERIENCE", title: "Minimum 5 years in transformer manufacturing/supply", description: "Track record in distribution transformer supply.", mandatory: true, evidenceRequired: true, params: { years: 5 }, confidence: 0.8 },
      { code: "R6", type: "CERTIFICATE", title: "BIS certification (IS 1180)", description: "BIS/ISI mark for offered transformer model.", mandatory: true, evidenceRequired: true, params: { certificateName: "BIS (IS 1180)" }, confidence: 0.76 },
      { code: "R7", type: "TECHNICAL_SPEC", title: "Energy efficiency certificate (Level-3)", description: "BEE star rating or energy test report.", mandatory: true, evidenceRequired: true, confidence: 0.75 },
    ],
    // Tender 2: MSME Solar
    [
      { code: "R1", type: "GST_REGISTRATION", title: "Active GST registration", description: "Valid GSTIN.", mandatory: true, evidenceRequired: true, confidence: 0.91 },
      { code: "R2", type: "PAN", title: "Valid PAN", description: "PAN in bidder's name.", mandatory: true, evidenceRequired: true, confidence: 0.89 },
      { code: "R3", type: "UDYAM", title: "Udyam (MSME) registration mandatory", description: "Bidder must be MSME registered.", mandatory: true, evidenceRequired: true, confidence: 0.92 },
      { code: "R4", type: "LOCAL_CONTENT", title: "Minimum 40% local content", description: "Make in India compliance.", mandatory: true, evidenceRequired: true, params: { localContentPct: 40 }, confidence: 0.87 },
      { code: "R5", type: "ORGANIZATION", title: "DPIIT Startup recognition (if claiming startup benefit)", description: "Optional for startup bidders.", mandatory: false, evidenceRequired: true, params: { criterion: "startup" }, confidence: 0.7 },
      { code: "R6", type: "TECHNICAL_SPEC", title: "Inverter datasheet and test certificate", description: "Technical specifications of offered inverter.", mandatory: true, evidenceRequired: true, confidence: 0.82 },
    ],
    // Tender 3: HVAC Defence
    [
      { code: "R1", type: "GST_REGISTRATION", title: "Active GST registration", description: "Valid GSTIN.", mandatory: true, evidenceRequired: true, confidence: 0.94 },
      { code: "R2", type: "PAN", title: "Valid PAN", description: "PAN in organization's name.", mandatory: true, evidenceRequired: true, confidence: 0.92 },
      { code: "R3", type: "TURNOVER", title: "Average annual turnover ≥ ₹1000 Lakh (₹10 Crore)", description: "Last 3 years audited statements.", mandatory: true, evidenceRequired: true, params: { minTurnoverLakh: 1000 }, confidence: 0.85 },
      { code: "R4", type: "EXPERIENCE", title: "Minimum 5 years in HVAC installations", description: "Proven track record in defence/institutional projects.", mandatory: true, evidenceRequired: true, params: { years: 5 }, confidence: 0.81 },
      { code: "R5", type: "OEM_AUTHORIZATION", title: "OEM authorization from international HVAC manufacturer", description: "Must be authorized by a recognized OEM.", mandatory: true, evidenceRequired: true, confidence: 0.83 },
      { code: "R6", type: "CERTIFICATE", title: "ISO 9001:2015 Quality Management", description: "Valid QMS certification.", mandatory: true, evidenceRequired: true, params: { certificateName: "ISO 9001:2015" }, confidence: 0.79 },
      { code: "R7", type: "CERTIFICATE", title: "ISO 14001:2015 Environmental Management", description: "Valid EMS certification.", mandatory: true, evidenceRequired: true, params: { certificateName: "ISO 14001:2015" }, confidence: 0.77 },
      { code: "R8", type: "EMD", title: "EMD of ₹15 Lakh", description: "Earnest money deposit.", mandatory: true, evidenceRequired: false, params: { amountLakh: 15 }, confidence: 0.9 },
      { code: "R9", type: "DECLARATION", title: "Defence procurement compliance declaration", description: "Self-declaration for defence procurement terms.", mandatory: true, evidenceRequired: true, confidence: 0.72 },
    ],
    // Tender 4: LT Switchgear
    [
      { code: "R1", type: "GST_REGISTRATION", title: "Active GST registration", description: "Valid GSTIN.", mandatory: true, evidenceRequired: true, confidence: 0.9 },
      { code: "R2", type: "PAN", title: "Valid PAN", description: "PAN in bidder's name.", mandatory: true, evidenceRequired: true, confidence: 0.88 },
      { code: "R3", type: "EXPERIENCE", title: "Minimum 3 years in switchgear manufacturing", description: "Track record required.", mandatory: true, evidenceRequired: true, params: { years: 3 }, confidence: 0.83 },
      { code: "R4", type: "TURNOVER", title: "Average annual turnover ≥ ₹100 Lakh", description: "Financial statements.", mandatory: true, evidenceRequired: true, params: { minTurnoverLakh: 100 }, confidence: 0.8 },
      { code: "R5", type: "CERTIFICATE", title: "BIS certification (IS 8623)", description: "BIS/ISI mark for offered switchgear.", mandatory: true, evidenceRequired: true, params: { certificateName: "BIS (IS 8623)" }, confidence: 0.76 },
      { code: "R6", type: "TECHNICAL_SPEC", title: "Technical datasheet and type test reports", description: "Must conform to IS 8623.", mandatory: true, evidenceRequired: true, confidence: 0.78 },
    ],
  ];

  for (let t = 0; t < tenders.length; t++) {
    const reqs = requirementsByTender[t];
    for (let r = 0; r < reqs.length; r++) {
      const req = reqs[r];
      await prisma.tenderRequirement.create({
        data: {
          tenderId: tenders[t].id,
          code: req.code,
          type: req.type,
          title: req.title,
          description: req.description,
          mandatory: req.mandatory,
          evidenceRequired: req.evidenceRequired,
          paramsJson: JSON.stringify(req.params ?? {}),
          confidence: req.confidence,
          extractionMethod: "HEURISTIC",
          status: "APPROVED",
          approvedById: officerUser.id,
          approvedAt: new Date(),
          sourceDocument: "tender-document.pdf",
          page: Math.floor(Math.random() * 15) + 1,
          sourceText: `As per tender clause ${req.code}: ${req.title}`,
        },
      });
    }
  }

  console.log("✅ Tender requirements created");

  // ── Mock Government Registry Data ──
  const mockGstData = orgs.map((org) => ({
    registry: "GST" as const,
    key: org.gstin!,
    dataJson: JSON.stringify({
      gstin: org.gstin,
      legalName: org.legalName,
      tradeName: org.tradeName,
      status: "ACTIVE",
      registrationDate: org.incorporationDate?.toISOString().slice(0, 10),
      state: org.state,
    }),
  }));

  const mockPanData = orgs
    .filter((o) => o.pan)
    .map((org) => ({
      registry: "PAN" as const,
      key: org.pan!,
      dataJson: JSON.stringify({
        pan: org.pan,
        name: org.legalName,
        status: "ACTIVE",
        category: org.organizationType === "PROPRIETORSHIP" ? "Individual" : "Company",
      }),
    }));

  const mockUdyamData = orgs
    .filter((o) => o.udyamNumber)
    .map((org) => ({
      registry: "UDYAM" as const,
      key: org.udyamNumber!,
      dataJson: JSON.stringify({
        udyamNumber: org.udyamNumber,
        enterpriseName: org.legalName,
        enterpriseType: (org.annualTurnoverLakh ?? 0) > 500 ? "Medium" : "Small",
        status: "ACTIVE",
      }),
    }));

  // Add some mismatches for testing
  mockGstData[2].dataJson = JSON.stringify({
    gstin: "29PQRSY9012H1Z1",
    legalName: "PQR Systems and Technologies Pvt Ltd", // different legal name
    tradeName: "PQR Systems",
    status: "ACTIVE",
    registrationDate: "2008-11-10",
    state: "Karnataka",
  });

  // One inactive GST for anomaly detection
  mockGstData[4].dataJson = JSON.stringify({
    gstin: "07GUPTS7890B1Z6",
    legalName: "Gupta Steel & Alloys Pvt Ltd",
    tradeName: "Gupta Steel",
    status: "CANCELLED",
    registrationDate: "2011-01-18",
    state: "Delhi",
  });

  // PAN mismatch for testing
  mockPanData[4].dataJson = JSON.stringify({
    pan: "GUPTS7890B",
    name: "Gupta Steels Pvt Ltd", // name mismatch
    status: "ACTIVE",
    category: "Company",
  });

  await prisma.mockRegistry.createMany({
    data: [...mockGstData, ...mockPanData, ...mockUdyamData],
  });

  console.log("✅ Mock government registry data created");

  // ── Compliance Rules ──
  const ruleTypes = [
    { code: "RULE_GST", name: "GST Registration Rule", requirementType: "GST_REGISTRATION", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.5 },
    { code: "RULE_PAN", name: "PAN Verification Rule", requirementType: "PAN", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.2 },
    { code: "RULE_UDYAM", name: "Udyam/MSME Rule", requirementType: "UDYAM", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.0 },
    { code: "RULE_OEM", name: "OEM Authorization Rule", requirementType: "OEM_AUTHORIZATION", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.3 },
    { code: "RULE_TURNOVER", name: "Turnover Requirement Rule", requirementType: "TURNOVER", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.1 },
    { code: "RULE_EXPERIENCE", name: "Experience Requirement Rule", requirementType: "EXPERIENCE", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.1 },
    { code: "RULE_LOCAL_CONTENT", name: "Local Content Rule", requirementType: "LOCAL_CONTENT", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.0 },
    { code: "RULE_CERTIFICATE", name: "Certificate Verification Rule", requirementType: "CERTIFICATE", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.0 },
    { code: "RULE_DECLARATION", name: "Declaration Rule", requirementType: "DECLARATION", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 0.8 },
    { code: "RULE_TECHNICAL", name: "Technical Specification Rule", requirementType: "TECHNICAL_SPEC", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.0 },
    { code: "RULE_EMD", name: "EMD Rule", requirementType: "EMD", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "REVIEW" }), weight: 0.8 },
    { code: "RULE_STATUTORY", name: "Statutory Compliance Rule", requirementType: "STATUTORY", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "VERIFICATION_UNAVAILABLE" }), weight: 1.0 },
    { code: "RULE_ORG", name: "Organization Requirement Rule", requirementType: "ORGANIZATION", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 0.8 },
    { code: "RULE_FINANCIAL", name: "Financial Requirement Rule", requirementType: "FINANCIAL", expressionJson: JSON.stringify({ failOnMismatch: true, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 1.1 },
    { code: "RULE_OTHER", name: "Other Condition Rule", requirementType: "OTHER", expressionJson: JSON.stringify({ failOnMismatch: false, missingResult: "INSUFFICIENT_EVIDENCE" }), weight: 0.5 },
  ];

  for (const r of ruleTypes) {
    await prisma.complianceRule.create({
      data: {
        ...r,
        active: true,
        source: "SYSTEM",
        createdById: adminUser.id,
        approvedById: adminUser.id,
      },
    });
  }

  console.log("✅ Compliance rules created");

  // ── Notifications ──
  await prisma.notification.createMany({
    data: [
      { userId: bidderUsers[0].id, title: "Welcome to BidVerify AI", body: "Your account has been created. Complete your organization profile to start bidding.", kind: "INFO" },
      { userId: bidderUsers[0].id, title: "New tender matching your profile", body: "CPCL/PUMP/2026/014 — Supply of Industrial Pumps. Matches your manufacturing profile.", kind: "INFO", link: "/bidder/tenders" },
      { userId: officerUser.id, title: "Demo data loaded", body: "5 tenders and 15 bidder organizations have been seeded. Try uploading a tender document to test AI extraction.", kind: "INFO" },
    ],
  });

  console.log("✅ Notifications created");

  console.log("\n🎉 Seed complete!");
  console.log("\n📧 Demo Accounts:");
  console.log("  Officer:     rajesh.verma@procurement.gov.in / password123");
  console.log("  Bidder:      sunil.kumar@abcindustries.example / password123");
  console.log("  Admin:       admin@bidverify.ai / password123");
  console.log("  Evaluator:   priya.singh@procurement.gov.in / password123");
  console.log("  Auditor:     auditor@procurement.gov.in / password123");
  console.log("  Reviewer:    compliance@procurement.gov.in / password123");
  console.log("  Google Demo: Click 'Continue with Google (Demo)' on login page");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
