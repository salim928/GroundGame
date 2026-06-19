import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service role key (Section 16.2).
 * The API is the only Google client and the only service-role holder; RLS is the
 * second enforcement layer for any direct/anon access.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      this.logger.warn("SUPABASE_URL / SERVICE_ROLE_KEY not set — DB calls will fail until configured.");
    }
    this.client = createClient(url ?? "http://localhost", key ?? "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Verify a Supabase access token and return the user id, or null. */
  async getUserFromToken(token: string): Promise<{ id: string } | null> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  }
}
