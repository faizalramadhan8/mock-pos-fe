import { useMemo } from "react";
import { useThemeStore } from "@/stores";

export function useThemeClasses() {
  const dark = useThemeStore(s => s.dark);
  return useMemo(() => ({
    dark,
    bg: dark ? "bg-[#12100E]" : "bg-[#F8F3ED]",
    card: dark ? "bg-[#1C1916]" : "bg-white",
    card2: dark ? "bg-[#241F1B]" : "bg-[#FBF7F2]",
    bdr: dark ? "border-[#352E28]" : "border-[#E8DDD2]",
    tx: dark ? "text-[#EDE4D9]" : "text-[#2E1F14]",
    txm: dark ? "text-[#8A7E73]" : "text-[#8B7560]",
    txf: dark ? "text-[#5E5449]" : "text-[#B8A594]",
    elev: dark ? "bg-[#2A2420]" : "bg-[#F3ECE3]",
    inp: dark
      ? "bg-[#2A2420] border-[#352E28] text-[#EDE4D9] placeholder:text-[#5E5449]"
      : "bg-[#F3ECE3] border-[#E8DDD2] text-[#2E1F14] placeholder:text-[#B8A594]",
    ring: dark ? "bg-[#D4956B]/10" : "bg-[#A0673C]/[0.06]",
    acc: dark ? "text-[#E8B088]" : "text-[#A0673C]",
    accBg: dark ? "bg-[#D4956B]/15" : "bg-[#A0673C]/[0.07]",
  }), [dark]);
}
