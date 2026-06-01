import Link from "next/link";
import { logout } from "@/app/auth/actions";
import type { Profile } from "@/lib/types";
import {
  BookOpen,
  LogOut,
  Library,
  ClipboardList,
  MessageCircleQuestion,
  Trophy,
  Sparkles,
  Flame,
  Shield,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navForRole(role: Profile["role"]): NavItem[] {
  const catalog: NavItem = {
    href: "/catalogo",
    label: "Catálogo",
    icon: <Library className="h-4 w-4" />,
  };
  if (role === "alumno") {
    return [
      { href: "/mis-tareas", label: "Mis tareas", icon: <ClipboardList className="h-4 w-4" /> },
      catalog,
      { href: "/progreso", label: "Mi progreso", icon: <Trophy className="h-4 w-4" /> },
    ];
  }
  if (role === "profesor") {
    return [
      { href: "/tareas", label: "Tareas", icon: <ClipboardList className="h-4 w-4" /> },
      catalog,
      { href: "/preguntas", label: "Preguntas", icon: <MessageCircleQuestion className="h-4 w-4" /> },
    ];
  }
  // admin
  return [
    catalog,
    { href: "/admin/recursos", label: "Recursos", icon: <Shield className="h-4 w-4" /> },
  ];
}

export default function AppShell({
  profile,
  email,
  children,
}: {
  profile: Profile;
  email: string | null;
  children: React.ReactNode;
}) {
  const items = navForRole(profile.role);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-adventure sticky top-0 z-20 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <BookOpen className="h-6 w-6" />
            <span className="hidden sm:inline">LeoAventura</span>
          </Link>

          <nav className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/15"
              >
                {it.icon}
                <span className="hidden md:inline">{it.label}</span>
              </Link>
            ))}
          </nav>

          {profile.role === "alumno" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                {profile.total_points}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                <Flame className="h-3.5 w-3.5 text-accent" />
                {profile.streak_days}
              </span>
            </div>
          )}

          <form action={logout}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/15"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="text-muted border-t px-4 py-4 text-center text-xs">
        {profile.full_name ?? email} · {roleLabel(profile.role)} · LeoAventura
      </footer>
    </div>
  );
}

function roleLabel(role: Profile["role"]): string {
  return role === "alumno"
    ? "Estudiante"
    : role === "profesor"
      ? "Docente"
      : "Administrador";
}
