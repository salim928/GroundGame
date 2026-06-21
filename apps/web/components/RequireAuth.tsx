"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAccess, ROLE_HOME } from "@/lib/access";

/**
 * Client-side guard: signed-out users are bounced to /login, and signed-in users
 * who reach a page outside their role's allowed area are sent to their home.
 * Renders children immediately (session is client-only) so authed users see no flash.
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
    if (!canAccess(session.role, pathname)) router.replace(ROLE_HOME[session.role]);
  }, [router, pathname]);

  return <>{children}</>;
}
