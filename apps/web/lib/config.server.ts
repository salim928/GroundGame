// Editable campaign configuration. Reads the `app_config` table (service role,
// bypassing RLS) so super admins can change targets, projection weights and
// classification thresholds without a redeploy. Sensible defaults are used for
// any key that hasn't been set yet, so this works even before the keys exist.
// Cached for 60s to avoid hammering PostgREST on every dashboard render.
import { cache } from "react";
import { adminConfigured, adminRest } from "./admin.server";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "./analytics";
import type { ClassThresholds, ProjectionWeights } from "./types";

export interface CampaignConfig {
  /** Calling window (days remaining) used for the pace-to-target maths. */
  targetDays: number;
  /** Contacts expected per constituency (the per-constituency target). */
  targetContacts: number;
  weights: ProjectionWeights;
  thresholds: ClassThresholds;
}

export const CONFIG_DEFAULTS: CampaignConfig = {
  targetDays: 21,
  targetContacts: 10,
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
};

// app_config keys this feature owns.
export const CONFIG_KEYS = {
  campaign: "campaign",
  weights: "projection_weights",
  thresholds: "classification_thresholds",
} as const;

let cached: { at: number; value: CampaignConfig } | null = null;
const TTL = 60_000;

async function read(): Promise<CampaignConfig> {
  if (!adminConfigured) return CONFIG_DEFAULTS;
  try {
    const rows = await adminRest<Array<{ key: string; value: any }>>(
      "/rest/v1/app_config?select=key,value",
    );
    const byKey = new Map((rows ?? []).map((r) => [r.key, r.value]));
    const campaign = byKey.get(CONFIG_KEYS.campaign) ?? {};
    const weights = byKey.get(CONFIG_KEYS.weights) ?? {};
    const thresholds = byKey.get(CONFIG_KEYS.thresholds) ?? {};
    return {
      targetDays: num(campaign.targetDays, CONFIG_DEFAULTS.targetDays, 1, 365),
      targetContacts: num(campaign.targetContacts, CONFIG_DEFAULTS.targetContacts, 1, 100000),
      weights: {
        supportive: num(weights.supportive, DEFAULT_WEIGHTS.supportive, 0, 1),
        undecided: num(weights.undecided, DEFAULT_WEIGHTS.undecided, 0, 1),
        not_reached: num(weights.not_reached, DEFAULT_WEIGHTS.not_reached, 0, 1),
        opposed: num(weights.opposed, DEFAULT_WEIGHTS.opposed, 0, 1),
      },
      thresholds: {
        stronghold: num(thresholds.stronghold, DEFAULT_THRESHOLDS.stronghold, 0, 1),
        lean: num(thresholds.lean, DEFAULT_THRESHOLDS.lean, 0, 1),
        tossup: num(thresholds.tossup, DEFAULT_THRESHOLDS.tossup, 0, 1),
        weak: num(thresholds.weak, DEFAULT_THRESHOLDS.weak, 0, 1),
      },
    };
  } catch {
    return CONFIG_DEFAULTS;
  }
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Current campaign config (60s cache). Falls back to defaults on any error. */
export const getConfig = cache(async (): Promise<CampaignConfig> => {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const value = await read();
  cached = { at: Date.now(), value };
  return value;
});

/** Drop the cache so the next read reflects a just-saved change. */
export function invalidateConfig() {
  cached = null;
}
