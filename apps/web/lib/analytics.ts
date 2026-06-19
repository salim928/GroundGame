import type { Classification, ProjectionWeights, Spine } from "./types";

// NDC brand greens — single hex source for charts (mirrors the --brand-* CSS scale).
export const BRAND = {
  green600: "#0A7D34", // primary NDC green
  green500: "#12A150",
  green400: "#22B364",
} as const;

export const SUPPORT_COLORS = {
  supportive: "#15A34A", // NDC-green family, brighter for legibility on bars
  undecided: "#DDA02C",
  opposed: "#D64A3C",
  notReached: "#B2BAC8",
} as const;

export const DEFAULT_WEIGHTS: ProjectionWeights = {
  supportive: 1.0,
  undecided: 0.35,
  not_reached: 0.15,
  opposed: 0.0,
};

export function spineTotal(s: Spine): number {
  return s.supportive + s.undecided + s.opposed + s.notReached;
}

/** Weighted projection share (0–1) for a spine under the given weights (Section 11). */
export function projectShare(s: Spine, w: ProjectionWeights = DEFAULT_WEIGHTS): number {
  const total = spineTotal(s);
  if (total === 0) return 0;
  const weighted =
    s.supportive * w.supportive +
    s.undecided * w.undecided +
    s.notReached * w.not_reached +
    s.opposed * w.opposed;
  return weighted / total;
}

const THRESHOLDS: Record<Classification, number> = {
  stronghold: 0.65,
  lean: 0.55,
  tossup: 0.45,
  weak: 0,
};

export function classify(share: number): Classification {
  if (share >= THRESHOLDS.stronghold) return "stronghold";
  if (share >= THRESHOLDS.lean) return "lean";
  if (share >= THRESHOLDS.tossup) return "tossup";
  return "weak";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function addSpines(a: Spine, b: Spine): Spine {
  return {
    supportive: a.supportive + b.supportive,
    undecided: a.undecided + b.undecided,
    opposed: a.opposed + b.opposed,
    notReached: a.notReached + b.notReached,
  };
}

export const CLASS_LABEL: Record<Classification, string> = {
  stronghold: "Stronghold",
  lean: "Lean",
  tossup: "Tossup",
  weak: "Weak",
};
