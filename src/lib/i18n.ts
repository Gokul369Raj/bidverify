/* ─────────────────────────────────────────────────────────────────────────
   Bilingual copy for the public portal chrome and the landing page.

   Deliberately a plain object rather than a framework: the app only needs
   two languages and a handful of screens, and this keeps the client bundle
   tiny (a full i18n runtime would cost more than the strings themselves).

   Add a key to every locale or TypeScript will flag the mismatch — `Dict`
   is derived from the English entry, so `hi` must mirror its shape.
   ───────────────────────────────────────────────────────────────────────── */

export type Lang = "en" | "hi";

const en = {
  meta: {
    langName: "English",
    otherLangName: "हिन्दी",
  },
  topbar: {
    authority: "Government Procurement Portal",
    ministry: "Ministry of Petroleum & Natural Gas",
    skipToMain: "Skip to Main Content",
    textSize: "Text size",
    decrease: "Decrease text size",
    normal: "Normal text size",
    increase: "Increase text size",
    screenReader: "Screen Reader",
    language: "Language",
  },
  nav: {
    home: "Home",
    howItWorks: "How It Works",
    compliance: "Compliance",
    tenders: "Tenders",
    about: "About",
    search: "Search tenders",
    register: "Register",
    login: "Login",
    registerBidder: "Register as Bidder",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    primary: "Primary",
    mobile: "Mobile",
  },
  preamble: {
    eyebrow: "About this portal",
    title: "Integrated Bid Compliance Verification Platform",
    body:
      "BidGuard AI is a single-window platform for verifying bidder eligibility, documents and technical compliance against Government of India tender requirements. It reconciles records across GSTN, PAN, Udyam, EPFO, ESIC and other official sources, applies the tender's own rule set, and produces an evidence-backed recommendation for the procurement officer — while keeping the final decision with the officer.",
    notice:
      "Demonstration prototype built for Smart India Hackathon 2026. Not an official Government of India website.",
  },
  hero: {
    badge: "AI-Powered Verification",
    titleA: "AI-Powered Bid Compliance",
    titleB: "Verification for",
    titleC: "Government Tenders",
    body:
      "BidGuard AI verifies bidder documents, checks eligibility and evaluates technical & financial compliance against GSTN, PAN, Udyam, EPFO and ESIC — turning weeks of manual scrutiny into minutes of evidence-backed review.",
    ctaBidder: "Register as Bidder",
    ctaOfficer: "Officer / Admin Login",
    trust1: "GFR 2017 aligned",
    trust2: "30–50% faster evaluation",
    trust3: "Complete audit trail",
    noticesTitle: "Latest Tenders",
    viewAll: "View all",
    loading: "Loading live tender notices…",
    statActive: "Active Tenders",
    statBidders: "Registered Bidders",
    statRequirements: "Requirements Mapped",
  },
  quick: {
    searchTitle: "Search Tenders",
    searchDesc: "Browse live opportunities",
    vaultTitle: "Document Vault",
    vaultDesc: "Upload & verify documents",
    passportTitle: "Compliance Passport",
    passportDesc: "Your verified profile",
    insightsTitle: "Tender Insights",
    insightsDesc: "AI risk & gap analysis",
  },
  portals: {
    title: "Verified against official Government of India data sources",
    subtitle: "Every document is reconciled with the issuing authority.",
  },
  paths: {
    eyebrow: "Choose your pathway",
    title: "One platform, three ways to participate",
    body:
      "Bidders prepare and verify submissions. Officers evaluate with evidence. Administrators govern the rules, users and audit trail.",
    bidderEyebrow: "For Industry",
    bidderTitle: "Bidder Portal",
    bidderDesc:
      "Check eligibility, upload documents to a reusable vault and know your compliance status before you submit.",
    bidderCta: "Register as Bidder",
    bidderPoint1: "Entity Locker with verified documents",
    bidderPoint2: "Pre-submission compliance check",
    bidderPoint3: "Live tender search & alerts",
    officerEyebrow: "For Government",
    officerTitle: "Officer Portal",
    officerDesc:
      "Machine-readable requirements, automated verification and a complete audit trail for every evaluation decision.",
    officerCta: "Officer Login",
    officerPoint1: "Verification queue with evidence",
    officerPoint2: "Compliance matrix & comparison",
    officerPoint3: "Audit-ready decision records",
    adminEyebrow: "For Administrators",
    adminTitle: "Admin Control Center",
    adminDesc:
      "Govern tender creation, rule engine versions, user roles, portal integrations and platform-wide analytics.",
    adminCta: "Open Control Center",
    adminPoint1: "Tender & rule management",
    adminPoint2: "User, role & access control",
    adminPoint3: "Platform analytics & audit logs",
  },
  pipeline: {
    eyebrow: "Verification engine",
    title: "Twelve checks on every document",
    body:
      "Each uploaded document passes through a deterministic pipeline. A hard gate on document type prevents wrong-document fraud before scoring even begins.",
    step: "Step",
    bandVerified: "Verified",
    bandVerifiedDesc: "Passed all checks — valid document",
    bandReview: "Needs Review",
    bandReviewDesc: "Some checks uncertain — officer review",
    bandFailed: "Failed",
    bandFailedDesc: "Insufficient evidence or wrong type",
    s1t: "Document Intake", s1d: "PDF or image uploaded to the encrypted Entity Locker.",
    s2t: "OCR & Extraction", s2d: "Native text extraction with Tesseract OCR fallback.",
    s3t: "Cross-Portal Check", s3d: "GSTN, PAN, Udyam, EPFO and ESIC records reconciled.",
    s4t: "Forensic Analysis", s4d: "Tamper, signature and QR-code integrity checks.",
    s5t: "Rule Engine", s5d: "Tender-specific hard gates and weighted scoring.",
    s6t: "Officer Decision", s6d: "Evidence-backed recommendation, human-in-the-loop.",
  },
  capability: {
    eyebrow: "Platform capability",
    title: "Built for accountable procurement",
    body: "Every feature maps to a requirement in the GFR 2017 procurement lifecycle.",
    c1t: "Entity Locker", c1d: "Store verified PAN, GST, Udyam and experience certificates once and reuse them across tenders.",
    c2t: "OCR Extraction", c2d: "Native PDF text extraction with automatic Tesseract OCR fallback for scanned documents.",
    c3t: "Forensic Tamper Check", c3d: "Detects incremental PDF updates, embedded scripts and image manipulation signals.",
    c4t: "Tender Rule Engine", c4d: "Versioned, weighted rules with hard gates mapped to each tender's own requirement set.",
    c5t: "Risk Analytics", c5d: "Compliance scoring, anomaly detection and counterfactual gap analysis per bid.",
    c6t: "Immutable Audit Trail", c6d: "Every action, decision and document access is recorded with actor, IP and timestamp.",
  },
  process: {
    eyebrow: "Process",
    title: "From tender notice to decision",
    body:
      "A single continuous workflow — no parallel registers, no manual cross-checking, no lost paperwork.",
    cta: "Read the full process",
    p1t: "Tender published", p1d: "Officer creates the tender; AI extracts requirements from the PDF automatically.",
    p2t: "Bidder prepares", p2d: "Documents uploaded to the vault are verified and scored before submission.",
    p3t: "Automated verification", p3d: "The pipeline runs cross-portal checks, forensic analysis and rule scoring.",
    p4t: "Officer decides", p4d: "Evaluation with full evidence, comparison view and an audit-ready record.",
  },
  impact: {
    i1: "Reduction in manual verification effort",
    i2: "Faster tender evaluation cycle",
    i3: "Checks per document, fully auditable",
    i4: "Decisions traceable to evidence",
  },
  quote: {
    text: "Technology for Trust. Procurement for a Stronger India.",
    attribution: "Viksit Bharat 2047",
  },
  cta: {
    title: "Together for a transparent, efficient and inclusive procurement ecosystem.",
    body:
      "Join bidders and procurement officers already using BidGuard AI to make government procurement faster and fairer.",
    primary: "Create Bidder Account",
    secondary: "Officer / Admin Login",
    alreadyRegistered: "Already registered?",
    signIn: "Sign in to your account",
  },
  footer: {
    integratedTitle: "Integrated with Government of India Platforms",
    blurb:
      "Automated document verification, eligibility checking and evidence-backed evaluation for Government of India tenders — aligned to GFR 2017, GIGW 3.0 and the UX4G design system.",
    colPlatform: "Platform",
    colBidder: "For Bidders",
    colOfficer: "For Officers",
    colPolicies: "Policies",
    address: "No. 536, Anna Salai, Chennai, Tamil Nadu — 600018",
    tollFree: "1800-425-XXXX (Toll Free)",
    email: "support@bidguard.gov.in",
    sihTitle: "Built for Smart India Hackathon 2026 — Team Anveshak 2.0",
    sihBody:
      "Prototype submitted against the Ministry of Petroleum & Natural Gas problem statement on AI-assisted tender compliance verification.",
    rights: "Content owned by Team Anveshak 2.0.",
    lastUpdated: "Last updated",
    sitemap: "Sitemap",
    disclaimer: "Disclaimer",
    help: "Help",
    disclaimerLabel: "Disclaimer:",
    disclaimerBody:
      "This is a Smart India Hackathon prototype built for demonstration purposes. It is not an official website of the Government of India and does not represent any Ministry, Department or Public Sector Undertaking.",
  },
  auth: {
    signIn: "Sign In",
    password: "Password",
    email: "Registered Email ID",
    forgot: "Forgot?",
    backHome: "Back to portal home",
  },
};

/* `Dict` is derived from the English entry, so every locale must mirror its
   shape exactly — a missing Hindi string becomes a compile error. Values are
   widened to `string` (no `as const`) so translations can differ freely. */
export type Dict = typeof en;

const hi: Dict = {
  meta: {
    langName: "हिन्दी",
    otherLangName: "English",
  },
  topbar: {
    authority: "सरकारी खरीद पोर्टल",
    ministry: "पेट्रोलियम एवं प्राकृतिक गैस मंत्रालय",
    skipToMain: "मुख्य सामग्री पर जाएँ",
    textSize: "पाठ का आकार",
    decrease: "पाठ का आकार घटाएँ",
    normal: "सामान्य पाठ आकार",
    increase: "पाठ का आकार बढ़ाएँ",
    screenReader: "स्क्रीन रीडर",
    language: "भाषा",
  },
  nav: {
    home: "मुख्य पृष्ठ",
    howItWorks: "यह कैसे कार्य करता है",
    compliance: "अनुपालन",
    tenders: "निविदाएँ",
    about: "परिचय",
    search: "निविदा खोजें",
    register: "पंजीकरण",
    login: "लॉग इन",
    registerBidder: "बोलीदाता के रूप में पंजीकरण",
    openMenu: "मेनू खोलें",
    closeMenu: "मेनू बंद करें",
    primary: "मुख्य",
    mobile: "मोबाइल",
  },
  preamble: {
    eyebrow: "इस पोर्टल के बारे में",
    title: "एकीकृत बोली अनुपालन सत्यापन मंच",
    body:
      "बिडगार्ड एआई भारत सरकार की निविदा आवश्यकताओं के विरुद्ध बोलीदाता की पात्रता, दस्तावेज़ों और तकनीकी अनुपालन के सत्यापन हेतु एकल-खिड़की मंच है। यह जीएसटीएन, पैन, उद्यम, ईपीएफओ, ईएसआईसी तथा अन्य आधिकारिक स्रोतों से अभिलेखों का मिलान करता है, निविदा के अपने नियम-समूह लागू करता है, और क्रय अधिकारी के लिए साक्ष्य-आधारित सिफ़ारिश तैयार करता है — अंतिम निर्णय अधिकारी के पास ही रहता है।",
    notice:
      "स्मार्ट इंडिया हैकाथॉन 2026 हेतु निर्मित प्रदर्शन प्रारूप। यह भारत सरकार की आधिकारिक वेबसाइट नहीं है।",
  },
  hero: {
    badge: "एआई-संचालित सत्यापन",
    titleA: "एआई-संचालित बोली अनुपालन",
    titleB: "सत्यापन",
    titleC: "सरकारी निविदाओं हेतु",
    body:
      "बिडगार्ड एआई बोलीदाता के दस्तावेज़ों का सत्यापन करता है, पात्रता जाँचता है तथा जीएसटीएन, पैन, उद्यम, ईपीएफओ और ईएसआईसी के विरुद्ध तकनीकी एवं वित्तीय अनुपालन का मूल्यांकन करता है — सप्ताहों की मैनुअल जाँच को मिनटों में साक्ष्य-आधारित समीक्षा में बदलता है।",
    ctaBidder: "बोलीदाता के रूप में पंजीकरण",
    ctaOfficer: "अधिकारी / व्यवस्थापक लॉगिन",
    trust1: "जीएफआर 2017 के अनुरूप",
    trust2: "30–50% तेज़ मूल्यांकन",
    trust3: "पूर्ण ऑडिट ट्रेल",
    noticesTitle: "नवीनतम निविदाएँ",
    viewAll: "सभी देखें",
    loading: "सक्रिय निविदा सूचनाएँ लोड हो रही हैं…",
    statActive: "सक्रिय निविदाएँ",
    statBidders: "पंजीकृत बोलीदाता",
    statRequirements: "मैप की गई आवश्यकताएँ",
  },
  quick: {
    searchTitle: "निविदा खोजें",
    searchDesc: "सक्रिय अवसर देखें",
    vaultTitle: "दस्तावेज़ वॉल्ट",
    vaultDesc: "दस्तावेज़ अपलोड एवं सत्यापित करें",
    passportTitle: "अनुपालन पासपोर्ट",
    passportDesc: "आपकी सत्यापित प्रोफ़ाइल",
    insightsTitle: "निविदा अंतर्दृष्टि",
    insightsDesc: "एआई जोखिम एवं अंतराल विश्लेषण",
  },
  portals: {
    title: "भारत सरकार के आधिकारिक डेटा स्रोतों से सत्यापित",
    subtitle: "प्रत्येक दस्तावेज़ का मिलान जारीकर्ता प्राधिकरण से किया जाता है।",
  },
  paths: {
    eyebrow: "अपना मार्ग चुनें",
    title: "एक मंच, भागीदारी के तीन मार्ग",
    body:
      "बोलीदाता प्रस्तुतियाँ तैयार एवं सत्यापित करते हैं। अधिकारी साक्ष्य के साथ मूल्यांकन करते हैं। व्यवस्थापक नियम, उपयोगकर्ता और ऑडिट ट्रेल संचालित करते हैं।",
    bidderEyebrow: "उद्योग हेतु",
    bidderTitle: "बोलीदाता पोर्टल",
    bidderDesc:
      "पात्रता जाँचें, पुनः प्रयोग योग्य वॉल्ट में दस्तावेज़ अपलोड करें और प्रस्तुति से पहले अपनी अनुपालन स्थिति जानें।",
    bidderCta: "बोलीदाता के रूप में पंजीकरण",
    bidderPoint1: "सत्यापित दस्तावेज़ों सहित एंटिटी लॉकर",
    bidderPoint2: "प्रस्तुति-पूर्व अनुपालन जाँच",
    bidderPoint3: "सक्रिय निविदा खोज एवं अलर्ट",
    officerEyebrow: "शासन हेतु",
    officerTitle: "अधिकारी पोर्टल",
    officerDesc:
      "मशीन-पठनीय आवश्यकताएँ, स्वचालित सत्यापन तथा प्रत्येक मूल्यांकन निर्णय हेतु पूर्ण ऑडिट ट्रेल।",
    officerCta: "अधिकारी लॉगिन",
    officerPoint1: "साक्ष्य सहित सत्यापन कतार",
    officerPoint2: "अनुपालन मैट्रिक्स एवं तुलना",
    officerPoint3: "ऑडिट-योग्य निर्णय अभिलेख",
    adminEyebrow: "व्यवस्थापक हेतु",
    adminTitle: "व्यवस्थापक नियंत्रण केंद्र",
    adminDesc:
      "निविदा निर्माण, नियम-इंजन संस्करण, उपयोगकर्ता भूमिकाएँ, पोर्टल एकीकरण तथा मंच-व्यापी विश्लेषिकी का संचालन करें।",
    adminCta: "नियंत्रण केंद्र खोलें",
    adminPoint1: "निविदा एवं नियम प्रबंधन",
    adminPoint2: "उपयोगकर्ता, भूमिका एवं पहुँच नियंत्रण",
    adminPoint3: "मंच विश्लेषिकी एवं ऑडिट लॉग",
  },
  pipeline: {
    eyebrow: "सत्यापन इंजन",
    title: "प्रत्येक दस्तावेज़ पर बारह जाँचें",
    body:
      "प्रत्येक अपलोड किया गया दस्तावेज़ एक निर्धारित प्रक्रिया से गुज़रता है। दस्तावेज़ प्रकार पर कठोर गेट स्कोरिंग आरंभ होने से पहले ही गलत-दस्तावेज़ धोखाधड़ी रोकता है।",
    step: "चरण",
    bandVerified: "सत्यापित",
    bandVerifiedDesc: "सभी जाँचें उत्तीर्ण — वैध दस्तावेज़",
    bandReview: "समीक्षा आवश्यक",
    bandReviewDesc: "कुछ जाँचें अनिश्चित — अधिकारी समीक्षा",
    bandFailed: "विफल",
    bandFailedDesc: "अपर्याप्त साक्ष्य या गलत प्रकार",
    s1t: "दस्तावेज़ ग्रहण", s1d: "पीडीएफ या छवि एन्क्रिप्टेड एंटिटी लॉकर में अपलोड।",
    s2t: "ओसीआर एवं निष्कर्षण", s2d: "टेसरैक्ट ओसीआर सहायता के साथ मूल पाठ निष्कर्षण।",
    s3t: "क्रॉस-पोर्टल जाँच", s3d: "जीएसटीएन, पैन, उद्यम, ईपीएफओ एवं ईएसआईसी अभिलेखों का मिलान।",
    s4t: "फ़ॉरेंसिक विश्लेषण", s4d: "छेड़छाड़, हस्ताक्षर एवं क्यूआर-कोड अखंडता जाँच।",
    s5t: "नियम इंजन", s5d: "निविदा-विशिष्ट कठोर गेट एवं भारित स्कोरिंग।",
    s6t: "अधिकारी निर्णय", s6d: "साक्ष्य-आधारित सिफ़ारिश, मानव-नियंत्रित।",
  },
  capability: {
    eyebrow: "मंच क्षमता",
    title: "जवाबदेह खरीद हेतु निर्मित",
    body: "प्रत्येक सुविधा जीएफआर 2017 खरीद जीवन-चक्र की किसी आवश्यकता से जुड़ी है।",
    c1t: "एंटिटी लॉकर", c1d: "सत्यापित पैन, जीएसटी, उद्यम एवं अनुभव प्रमाणपत्र एक बार संग्रहित करें और सभी निविदाओं में पुनः उपयोग करें।",
    c2t: "ओसीआर निष्कर्षण", c2d: "स्कैन किए गए दस्तावेज़ों हेतु स्वचालित टेसरैक्ट ओसीआर सहायता के साथ मूल पीडीएफ पाठ निष्कर्षण।",
    c3t: "फ़ॉरेंसिक छेड़छाड़ जाँच", c3d: "वृद्धिशील पीडीएफ अद्यतन, अंतर्निहित स्क्रिप्ट एवं छवि हेरफेर संकेतों का पता लगाता है।",
    c4t: "निविदा नियम इंजन", c4d: "प्रत्येक निविदा के अपने आवश्यकता-समूह पर मैप किए गए संस्करणबद्ध, भारित नियम।",
    c5t: "जोखिम विश्लेषिकी", c5d: "प्रत्येक बोली हेतु अनुपालन स्कोरिंग, विसंगति पहचान एवं अंतराल विश्लेषण।",
    c6t: "अपरिवर्तनीय ऑडिट ट्रेल", c6d: "प्रत्येक कार्रवाई, निर्णय एवं दस्तावेज़ पहुँच कर्ता, आईपी और समय-चिह्न के साथ दर्ज।",
  },
  process: {
    eyebrow: "प्रक्रिया",
    title: "निविदा सूचना से निर्णय तक",
    body: "एक सतत कार्यप्रवाह — कोई समानांतर रजिस्टर नहीं, कोई मैनुअल मिलान नहीं, कोई खोया दस्तावेज़ नहीं।",
    cta: "पूरी प्रक्रिया पढ़ें",
    p1t: "निविदा प्रकाशित", p1d: "अधिकारी निविदा बनाता है; एआई पीडीएफ से आवश्यकताएँ स्वतः निकालता है।",
    p2t: "बोलीदाता तैयारी", p2d: "वॉल्ट में अपलोड दस्तावेज़ प्रस्तुति से पहले सत्यापित एवं स्कोर किए जाते हैं।",
    p3t: "स्वचालित सत्यापन", p3d: "प्रक्रिया क्रॉस-पोर्टल जाँच, फ़ॉरेंसिक विश्लेषण एवं नियम स्कोरिंग चलाती है।",
    p4t: "अधिकारी निर्णय", p4d: "पूर्ण साक्ष्य, तुलना दृश्य एवं ऑडिट-योग्य अभिलेख के साथ मूल्यांकन।",
  },
  impact: {
    i1: "मैनुअल सत्यापन प्रयास में कमी",
    i2: "निविदा मूल्यांकन चक्र में तेज़ी",
    i3: "प्रत्येक दस्तावेज़ पर जाँचें, पूर्णतः ऑडिट-योग्य",
    i4: "निर्णय साक्ष्य तक अनुसरणीय",
  },
  quote: {
    text: "विश्वास हेतु तकनीक। सशक्त भारत हेतु खरीद।",
    attribution: "विकसित भारत 2047",
  },
  cta: {
    title: "पारदर्शी, कुशल एवं समावेशी खरीद पारिस्थितिकी तंत्र हेतु एक साथ।",
    body:
      "उन बोलीदाताओं एवं क्रय अधिकारियों से जुड़ें जो सरकारी खरीद को तेज़ और निष्पक्ष बनाने के लिए बिडगार्ड एआई का उपयोग कर रहे हैं।",
    primary: "बोलीदाता खाता बनाएँ",
    secondary: "अधिकारी / व्यवस्थापक लॉगिन",
    alreadyRegistered: "पहले से पंजीकृत?",
    signIn: "अपने खाते में साइन इन करें",
  },
  footer: {
    integratedTitle: "भारत सरकार के मंचों के साथ एकीकृत",
    blurb:
      "भारत सरकार की निविदाओं हेतु स्वचालित दस्तावेज़ सत्यापन, पात्रता जाँच एवं साक्ष्य-आधारित मूल्यांकन — जीएफआर 2017, जीआईजीडब्ल्यू 3.0 एवं यूएक्स4जी डिज़ाइन प्रणाली के अनुरूप।",
    colPlatform: "मंच",
    colBidder: "बोलीदाताओं हेतु",
    colOfficer: "अधिकारियों हेतु",
    colPolicies: "नीतियाँ",
    address: "नं. 536, अन्ना सालै, चेन्नई, तमिलनाडु — 600018",
    tollFree: "1800-425-XXXX (टोल फ्री)",
    email: "support@bidguard.gov.in",
    sihTitle: "स्मार्ट इंडिया हैकाथॉन 2026 हेतु निर्मित — टीम अन्वेषक 2.0",
    sihBody:
      "एआई-सहायित निविदा अनुपालन सत्यापन पर पेट्रोलियम एवं प्राकृतिक गैस मंत्रालय की समस्या-कथन हेतु प्रस्तुत प्रारूप।",
    rights: "सामग्री का स्वामित्व टीम अन्वेषक 2.0 के पास है।",
    lastUpdated: "अंतिम अद्यतन",
    sitemap: "साइटमैप",
    disclaimer: "अस्वीकरण",
    help: "सहायता",
    disclaimerLabel: "अस्वीकरण:",
    disclaimerBody:
      "यह प्रदर्शन हेतु निर्मित स्मार्ट इंडिया हैकाथॉन प्रारूप है। यह भारत सरकार की आधिकारिक वेबसाइट नहीं है और किसी मंत्रालय, विभाग या सार्वजनिक क्षेत्र के उपक्रम का प्रतिनिधित्व नहीं करता।",
  },
  auth: {
    signIn: "साइन इन",
    password: "पासवर्ड",
    email: "पंजीकृत ईमेल आईडी",
    forgot: "भूल गए?",
    backHome: "पोर्टल मुख्य पृष्ठ पर लौटें",
  },
};

export const DICTS: Record<Lang, Dict> = { en, hi };

export const LANG_STORAGE_KEY = "bidguard_lang";

/** Resolve a dot-path key against a dictionary, falling back to English. */
export function translate(lang: Lang, path: string): string {
  const read = (dict: Dict) =>
    path.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, dict);

  const value = read(DICTS[lang]);
  if (typeof value === "string") return value;
  const fallback = read(DICTS.en);
  return typeof fallback === "string" ? fallback : path;
}
