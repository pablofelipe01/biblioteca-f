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
  // pdf-parse usa APIs de Node; evitamos que el bundler intente empaquetarlo.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
