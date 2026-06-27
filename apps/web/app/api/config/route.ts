// Campaign configuration API (privileged, service-role). Reads are open to any
// signed-in staffer; writes are super-admin only. Persists to the `app_config`
// table so changes take effect without a redeploy.
import { NextResponse } from "next/server";
import { adminConfigured, adminRest, getRequester, serverError } from "@/lib/admin.server";
import { CONFIG_KEYS, getConfig, invalidateConfig } from "@/lib/config.server";

export const dynamic = "force-dynamic";

function configError() {
  return NextResponse.json({ error: "Server is not configured for admin actions." }, { status: 503 });
}

function clamp(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// GET /api/config — current campaign config.
export async function GET(req: Request) {
  if (!adminConfigured) return configError();
  try {
    const me = await getRequester(req);
    if (!me) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    return NextResponse.json({ config: await getConfig() });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH /api/config — update targets, weights and thresholds (super admin only).
export async function PATCH(req: Request) {
  if (!adminConfigured) return configError();
  try {
    const me = await getRequester(req);
    if (!me) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    if (me.role !== "super_admin") {
      return NextResponse.json({ error: "Only a super admin can change campaign settings." }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const current = await getConfig();
    const c = body.campaign ?? body;
    const w = body.weights ?? {};
    const t = body.thresholds ?? {};

    const campaign = {
      targetDays: clamp(c.targetDays, current.targetDays, 1, 365),
      targetContacts: clamp(c.targetContacts, current.targetContacts, 1, 100000),
    };
    const weights = {
      supportive: clamp(w.supportive, current.weights.supportive, 0, 1),
      undecided: clamp(w.undecided, current.weights.undecided, 0, 1),
      not_reached: clamp(w.not_reached, current.weights.not_reached, 0, 1),
      opposed: clamp(w.opposed, current.weights.opposed, 0, 1),
    };
    const thresholds = {
      stronghold: clamp(t.stronghold, current.thresholds.stronghold, 0, 1),
      lean: clamp(t.lean, current.thresholds.lean, 0, 1),
      tossup: clamp(t.tossup, current.thresholds.tossup, 0, 1),
      weak: clamp(t.weak, current.thresholds.weak, 0, 1),
    };

    await adminRest("/rest/v1/app_config?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([
        { key: CONFIG_KEYS.campaign, value: campaign },
        { key: CONFIG_KEYS.weights, value: weights },
        { key: CONFIG_KEYS.thresholds, value: thresholds },
      ]),
    });
    invalidateConfig();

    return NextResponse.json({ ok: true, config: { ...campaign, weights, thresholds } });
  } catch (e) {
    return serverError(e);
  }
}
