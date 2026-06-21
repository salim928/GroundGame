"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Client-side guard: signed-out users are bounced to /login.
 * Renders children immediately (session lives in localStorage, client-only) and
 * redirects on mount if there's no session — so authed users see no spinner flash.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    // Callers don't belong on the staff dashboard — send them to their console.
    if (session.role === "caller") router.replace("/caller");
  }, [router, pathname]);

  return <>{children}</>;
}
