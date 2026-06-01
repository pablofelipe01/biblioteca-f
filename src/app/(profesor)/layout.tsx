import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function ProfesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireRole(["profesor", "admin"]);
  return (
    <AppShell profile={profile} email={email}>
      {children}
    </AppShell>
  );
}
