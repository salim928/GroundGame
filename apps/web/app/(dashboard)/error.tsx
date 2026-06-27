"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Error boundary for dashboard pages — a Supabase/network hiccup shows a clean,
// recoverable card instead of a broken page or a raw stack trace.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the server/console logs for debugging without exposing details to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <TriangleAlert size={22} />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t load this page. This is usually temporary — try again in a moment.
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw /> Try again
      </Button>
    </div>
  );
}
