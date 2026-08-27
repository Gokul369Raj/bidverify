import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIDGUARD AI — AI-Powered Bid Compliance Verification Platform",
  description: "AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement. Automated verification of bidder eligibility against GSTN, PAN, Udyam, EPFO, ESIC and 14+ government portals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
