import { ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.guard";

/** True if the user may read the given constituency (mirrors gg_can_see_constituency in SQL). */
export function canSeeConstituency(user: AuthUser, constituencyRegionId: string | null, constituencyId: string): boolean {
  switch (user.role) {
    case "super_admin":
    case "analyst":
      return true;
    case "regional_coordinator":
      return !!user.regionId && user.regionId === constituencyRegionId;
    case "constituency_coordinator":
      return user.constituencyId === constituencyId;
    default:
      return false;
  }
}

export function assertCanSeeConstituency(user: AuthUser, regionId: string | null, constituencyId: string): void {
  if (!canSeeConstituency(user, regionId, constituencyId)) {
    throw new ForbiddenException("Out of scope");
  }
}

/** Region filter for list queries — null means "all regions" (super_admin / analyst). */
export function regionFilter(user: AuthUser): string | null {
  if (user.role === "regional_coordinator") return user.regionId;
  return null;
}
