                                                                                                                                                 
                                                 
export const WEIGHTS = { severity: 0.35, impact: 0.25, scale: 0.15, confidence: 0.25, effortPenalty: 1.5 };
export function score(i            , w = WEIGHTS) {
  const scale = Math.min(1, Math.log10(1 + i.affected) / 2);
  const base = 100 * (w.severity * i.severity / 5 + w.impact * i.impact / 5 + w.scale * scale + w.confidence * i.confidence);
  const s = Math.max(0, base * (0.5 + 0.5 * i.evidence) - (i.effort - 1) * w.effortPenalty);
  // P1 gate: high score AND severe AND well-supported, so a missing title can never reach P1 on its own.
  const priority           = s >= 75 && i.severity >= 4 && i.confidence >= 0.8 ? 'P1' : s >= 55 ? 'P2' : s >= 35 ? 'P3' : 'P4';
  return { score: Math.round(s * 10) / 10, priority };
}
