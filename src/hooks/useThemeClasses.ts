import { useMemo } from "react";
import { useThemeStore } from "@/stores";

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens — "Confectionery Warmth" palette
// ─────────────────────────────────────────────────────────────────────────────
// Light mode derives from owner's primary #FFB5C0 (soft strawberry). Surfaces
// step through cream → marshmallow → rose petal so layered cards still read
// distinctly. Accent color is cherry (#E11D48) — meets WCAG AA (≈5.6:1 on
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
    bg: dark ? "bg-[#140B0F]" : "bg-[#FFF4F6]",
    // Card surface
    card: dark ? "bg-[#261620]" : "bg-white",
    // Secondary/nested surface
    card2: dark ? "bg-[#1E1118]" : "bg-[#FFE4E9]",
    // Borders
    bdr: dark ? "border-[#3D2230]" : "border-[#F9C5D0]",
    bdrSoft: dark ? "border-[#261620]" : "border-[#FFE4E9]",
    // Text hierarchy
    tx: dark ? "text-[#FBE8EE]" : "text-[#2B1318]",
    txm: dark ? "text-[#C9A5AF]" : "text-[#6E4E57]",
    txf: dark ? "text-[#8E6F79]" : "text-[#A98C94]",
    // Muted fill (for icon backgrounds, quantity pills, etc)
    elev: dark ? "bg-[#3D2230]" : "bg-[#FFD1DB]",
    // Form input
    inp: dark
      ? "bg-[#1E1118] border-[#3D2230] text-[#FBE8EE] placeholder:text-[#8E6F79]"
      : "bg-white border-[#F9C5D0] text-[#2B1318] placeholder:text-[#A98C94]",
    // Soft accent tint (category chip bg, subtle highlight)
    ring: dark ? "bg-[#E11D48]/15" : "bg-[#FFE4E9]",
    // Primary accent (prices, CTA text, links)
    acc: dark ? "text-[#FB7185]" : "text-[#E11D48]",
    // Primary accent background (soft wash behind accent icons)
    accBg: dark ? "bg-[#E11D48]/20" : "bg-[#FFE4E9]",
  }), [dark]);
}
