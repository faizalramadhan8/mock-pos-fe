import { useMemo } from "react";
import { useThemeStore } from "@/stores";

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens — "Confectionery Warmth" palette
// ─────────────────────────────────────────────────────────────────────────────
// Light mode derives from owner's primary var(--color-cherry-300) (soft strawberry). Surfaces
// step through cream → marshmallow → rose petal so layered cards still read
// distinctly. Accent color is cherry (var(--color-cherry-500)) — meets WCAG AA (≈5.6:1 on
// white) so prices and CTA text are legible for 50+ users.
//
// Dark mode is a warm maroon bath (not cool slate) to keep the bakery feel
// at night while preserving contrast.
// ─────────────────────────────────────────────────────────────────────────────

export function useThemeClasses() {
  const dark = useThemeStore(s => s.dark);
  return useMemo(() => ({
    dark,
    // Page background — warm cream, never pure white
    bg: dark ? "bg-shade-bg" : "bg-cherry-50",
    // Card surface
    card: dark ? "bg-shade-card" : "bg-white",
    // Secondary/nested surface
    card2: dark ? "bg-shade-bg" : "bg-cherry-100",
    // Borders
    bdr: dark ? "border-shade-elev" : "border-cherry-200",
    bdrSoft: dark ? "border-shade-card" : "border-cherry-100",
    // Text hierarchy
    tx: dark ? "text-cherry-100" : "text-ink-900",
    txm: dark ? "text-[#C9A5AF]" : "text-ink-700",
    txf: dark ? "text-ink-500" : "text-ink-500",
    // Muted fill (for icon backgrounds, quantity pills, etc)
    elev: dark ? "bg-shade-elev" : "bg-cherry-200",
    // Form input
    inp: dark
      ? "bg-shade-bg border-shade-elev text-cherry-100 placeholder:text-ink-500"
      : "bg-white border-cherry-200 text-ink-900 placeholder:text-ink-500",
    // Soft accent tint (category chip bg, subtle highlight)
    ring: dark ? "bg-cherry-500/15" : "bg-cherry-100",
    // Primary accent (prices, CTA text, links)
    acc: dark ? "text-cherry-400" : "text-cherry-500",
    // Primary accent background (soft wash behind accent icons)
    accBg: dark ? "bg-cherry-500/20" : "bg-cherry-100",
  }), [dark]);
}
