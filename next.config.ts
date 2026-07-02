import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a este proyecto (hay un package-lock.json suelto
  // en el directorio home que confunde la autodetección de Turbopack).
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // Portadas de respaldo desde Open Library (ver §5 del spec).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
    ],
  },
  // pdf-parse (y su dependencia pdfjs-dist) usan APIs de Node; los dejamos
  // fuera del bundle para que se resuelvan en runtime desde node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
