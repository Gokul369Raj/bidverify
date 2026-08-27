import { AppShell } from "@/components/AppShell";

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="officer">{children}</AppShell>;
}
