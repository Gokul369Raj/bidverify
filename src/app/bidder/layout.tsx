import { AppShell } from "@/components/AppShell";

export default function BidderLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="bidder">{children}</AppShell>;
}
