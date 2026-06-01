import Link from "next/link";
import { BookX, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <BookX className="h-12 w-12 text-brand" />
      <div>
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p className="text-muted mt-1">
          Esta aventura no existe o ya no está disponible.
        </p>
      </div>
      <Link
        href="/"
        className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white"
      >
        <Home className="h-4 w-4" /> Volver al inicio
      </Link>
    </div>
  );
}
