"use client";

import { useState } from "react";
import ResourceEditor from "@/components/ResourceEditor";
import { Plus } from "lucide-react";

export default function NewResourceButton() {
  const [open, setOpen] = useState(false);
  if (open) {
    return <ResourceEditor onDone={() => setOpen(false)} />;
  }
  return (
    <button
      onClick={() => setOpen(true)}
      className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
    >
      <Plus className="h-4 w-4" /> Nuevo recurso
    </button>
  );
}
