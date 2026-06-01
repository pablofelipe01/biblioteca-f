"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Loader2, Mail, KeyRound, Sparkles } from "lucide-react";

type Mode = "password" | "magic" | "signup";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        setMessage(
          "¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.",
        );
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        setMessage("Te enviamos un enlace mágico a tu correo. ¡Ábrelo para entrar!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
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
          {/* Selector de modo */}
          <div className="mb-5 flex gap-1 rounded-xl bg-background p-1 text-sm">
            {(
              [
                ["password", "Entrar"],
                ["magic", "Enlace mágico"],
                ["signup", "Crear cuenta"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setMessage(null);
                }}
                className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition ${
                  mode === m
                    ? "bg-card text-brand shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field
                label="Nombre completo"
                value={fullName}
                onChange={setFullName}
                type="text"
                placeholder="Tu nombre"
                required
              />
            )}
            <Field
              label="Correo electrónico"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="tucorreo@colegio.edu"
              required
              icon={<Mail className="h-4 w-4" />}
            />
            {mode !== "magic" && (
              <Field
                label="Contraseña"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
                required
                icon={<KeyRound className="h-4 w-4" />}
              />
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                {message}
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
              {mode === "password"
                ? "Iniciar sesión"
                : mode === "signup"
                  ? "Crear mi cuenta"
                  : "Enviar enlace mágico"}
            </button>
          </form>
        </div>

        <p className="text-muted mt-6 text-center text-xs">
          Al continuar aceptas el uso educativo de la plataforma.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="relative">
        {icon && (
          <span className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded-xl border bg-background py-2.5 ${
            icon ? "pl-9 pr-3" : "px-3"
          } outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20`}
        />
      </div>
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
