"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-danger" />
      <div>
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-muted mt-1">
          Ocurrió un error inesperado. Puedes intentar de nuevo.
        </p>
      </div>
      <button
        onClick={reset}
        className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white"
      >
        <RotateCw className="h-4 w-4" /> Reintentar
      </button>
    </div>
  );
}
