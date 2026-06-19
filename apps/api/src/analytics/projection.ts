// Projection model (Section 11). Weights live in app_config and are applied here — not hard-coded.
export interface Spine {
  supportive: number;
  undecided: number;
  opposed: number;
  notReached: number;
}

export interface Weights {
  supportive: number;
  undecided: number;
  not_reached: number;
  opposed: number;
}

export const DEFAULT_WEIGHTS: Weights = { supportive: 1.0, undecided: 0.35, not_reached: 0.15, opposed: 0.0 };

export function emptySpine(): Spine {
  return { supportive: 0, undecided: 0, opposed: 0, notReached: 0 };
}

export function addSpine(a: Spine, b: Spine): Spine {
  return {
    supportive: a.supportive + b.supportive,
    undecided: a.undecided + b.undecided,
    opposed: a.opposed + b.opposed,
    notReached: a.notReached + b.notReached,
  };
}

export function spineTotal(s: Spine): number {
  return s.supportive + s.undecided + s.opposed + s.notReached;
}

export function projectShare(s: Spine, w: Weights = DEFAULT_WEIGHTS): number {
  const total = spineTotal(s);
  if (!total) return 0;
  return (
    (s.supportive * w.supportive + s.undecided * w.undecided + s.notReached * w.not_reached + s.opposed * w.opposed) /
    total
  );
}

export type Classification = "stronghold" | "lean" | "tossup" | "weak";

export function classify(share: number, thresholds?: Record<Classification, number>): Classification {
  const t = thresholds ?? { stronghold: 0.65, lean: 0.55, tossup: 0.45, weak: 0 };
  if (share >= t.stronghold) return "stronghold";
  if (share >= t.lean) return "lean";
  if (share >= t.tossup) return "tossup";
  return "weak";
}

/** Fold a delegate's call record into a spine bucket. */
export function bucket(
  s: Spine,
  reached: boolean,
  outcome: "supportive" | "undecided" | "hostile" | "wrong_number" | null,
): Spine {
  if (!reached) return { ...s, notReached: s.notReached + 1 };
  if (outcome === "supportive") return { ...s, supportive: s.supportive + 1 };
  if (outcome === "hostile") return { ...s, opposed: s.opposed + 1 };
  return { ...s, undecided: s.undecided + 1 };
}
