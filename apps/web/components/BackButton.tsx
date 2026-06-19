"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton({ fallback = "/dashboard", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <ChevronLeft size={16} /> {label}
    </button>
  );
}
