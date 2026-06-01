import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AlumnoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireRole(["alumno"]);
  return (
    <AppShell profile={profile} email={email}>
      {children}
    </AppShell>
  );
}
