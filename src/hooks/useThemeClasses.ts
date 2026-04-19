import { useMemo } from "react";
import { useThemeStore } from "@/stores";

export function useThemeClasses() {
  const dark = useThemeStore(s => s.dark);
  return useMemo(() => ({
    dark,
    bg: dark ? "bg-[#020617]" : "bg-[#F1F5F9]",
    card: dark ? "bg-[#1E293B]" : "bg-white",
    card2: dark ? "bg-[#1E293B]" : "bg-[#F8FAFC]",
    bdr: dark ? "border-[#334155]" : "border-[#E2E8F0]",
    bdrSoft: dark ? "border-[#1E293B]" : "border-[#E2E8F0]",
    tx: dark ? "text-[#F1F5F9]" : "text-[#0F172A]",
    txm: dark ? "text-[#94A3B8]" : "text-[#64748B]",
    txf: dark ? "text-[#64748B]" : "text-[#94A3B8]",
    elev: dark ? "bg-[#334155]" : "bg-[#E2E8F0]",
    inp: dark
      ? "bg-[#334155] border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B]"
      : "bg-[#E2E8F0] border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8]",
    ring: dark ? "bg-[#60A5FA]/10" : "bg-[#1E40AF]/[0.06]",
    acc: dark ? "text-[#60A5FA]" : "text-[#1E40AF]",
    accBg: dark ? "bg-[#60A5FA]/15" : "bg-[#1E40AF]/[0.07]",
  }), [dark]);
}
