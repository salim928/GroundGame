import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SupabaseService } from "../supabase/supabase.service";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  role: string;
  regionId: string | null;
  constituencyId: string | null;
}

/** Layer one: verify the Supabase JWT and attach the user's profile scope to the request. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    const user = await this.supabase.getUserFromToken(token);
    if (!user) throw new UnauthorizedException("Invalid token");

    const { data: profile } = await this.supabase.client
      .from("profiles")
      .select("role, region_id, constituency_id, is_active")
      .eq("user_id", user.id)
      .single();

    if (!profile || !profile.is_active) throw new UnauthorizedException("No active profile");

    req.user = {
      id: user.id,
      role: profile.role,
      regionId: profile.region_id,
      constituencyId: profile.constituency_id,
    } satisfies AuthUser;
    return true;
  }
}
