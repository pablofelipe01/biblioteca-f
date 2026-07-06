"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { idToEmail, isValidId, isValidPin } from "@/lib/login-id";
import { BookOpen, Loader2, IdCard, KeyRound, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/";

  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanId = id.trim();
    const cleanPin = pin.trim();
    if (!isValidId(cleanId)) {
      setError("Ingresa tu número de documento (6 a 11 dígitos).");
      return;
    }
    if (!isValidPin(cleanPin)) {
      setError("El PIN debe tener 4 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: idToEmail(cleanId),
        password: cleanPin,
      });
      if (error) {
        setError("ID o PIN incorrectos. Verifica tus datos.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-adventure mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">LeoAventura</h1>
          <p className="text-muted mt-1">
            Tu biblioteca escolar de aventuras lectoras
          </p>
        </div>

        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Número de identificación
              </span>
              <div className="relative">
                <span className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <IdCard className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={id}
                  onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Tu número de documento"
                  required
                  className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 tracking-widest outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">PIN</span>
              <div className="relative">
                <span className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <KeyRound className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4 dígitos"
                  required
                  className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 tracking-[0.5em] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <span className="text-muted mt-1 block text-xs">
                Tu PIN son los últimos 4 dígitos de tu identificación.
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-adventure flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Entrar
            </button>
          </form>
        </div>

        <p className="text-muted mt-6 text-center text-xs">
          ¿Problemas para entrar? Contacta a tu institución.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
