import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MemberProvider } from "@/contexts/MemberContext";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAuth>
      <MemberProvider>
        <AppShell>{children}</AppShell>
      </MemberProvider>
    </RequireAuth>
  );
}
