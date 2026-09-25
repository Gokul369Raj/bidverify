import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

/* Noto Sans is the typeface family used across Government of India web
   properties — it covers Latin + Devanagari in one family, which we need for
   the "सत्यमेव जयते" motto and the Hindi UI. It is self-hosted (see the
   @font-face rules in globals.css) so builds never depend on the network. */

export const metadata: Metadata = {
  title: {
    default: "BidGuard AI | Government Bid Compliance Verification Platform",
    template: "%s | BidGuard AI",
  },
  description:
    "AI-powered integrated bid compliance verification platform for government procurement. Automated verification of bidder eligibility against GSTN, PAN, Udyam, EPFO, ESIC and 14+ government portals.",
  applicationName: "BidGuard AI",
  keywords: [
    "government tender", "bid compliance", "GeM", "procurement", "GSTN",
    "Udyam", "e-tender", "Smart India Hackathon",
  ],
  authors: [{ name: "Team Anveshak 2.0" }],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#041E42",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* React 19 hoists these into <head>. Preloading the Latin subset
            avoids a flash of fallback text on first paint. */}
        <link
          rel="preload"
          href="/fonts/NotoSans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <a href="#main-content" className="skip-link">Skip to Main Content</a>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
