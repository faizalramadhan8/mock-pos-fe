interface IconProps {
  color?: string;
  size?: number;
}

export const FlourIcon = ({ color = "#3B82F6", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 21V10" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8.5 7.5C8.5 5.5 10 4 12 4" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M7.5 11C7 9 8.5 7 10.5 6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M7 14.5C6 12.5 7.5 10.5 9.5 10" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M15.5 7.5C15.5 5.5 14 4 12 4" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M16.5 11C17 9 15.5 7 13.5 6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M17 14.5C18 12.5 16.5 10.5 14.5 10" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M12 4V2" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

export const SugarIcon = ({ color = "#D4627A", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10 6l4-2 4 2v4l-4 2-4-2V6z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color} fillOpacity=".08"/>
    <path d="M14 4v4M10 6l4 2 4-2" stroke={color} strokeWidth="1.2" opacity=".4"/>
    <path d="M6 12l4-2 4 2v4l-4 2-4-2v-4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color} fillOpacity=".12"/>
    <path d="M10 10v4M6 12l4 2 4-2" stroke={color} strokeWidth="1.2" opacity=".4"/>
    <circle cx="18" cy="9" r=".8" fill={color} opacity=".5"/>
    <circle cx="16" cy="14" r=".6" fill={color} opacity=".3"/>
  </svg>
);

export const DairyIcon = ({ color = "#5B8DEF", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3C8.5 3 6 8.5 6 13c0 3.87 2.69 7 6 7s6-3.13 6-7c0-4.5-2.5-10-6-10z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".07"/>
    <path d="M10 9c0-1.5 1-3 2.5-3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity=".5"/>
    <path d="M18 14c0 1.1-.6 2-1.5 2s-1.5-.9-1.5-2c0-.8.7-1.8 1.5-3 .8 1.2 1.5 2.2 1.5 3z" stroke={color} strokeWidth="1.2" fill={color} fillOpacity=".15"/>
  </svg>
);

export const ChocoIcon = ({ color = "#7D5A44", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="18" height="11" rx="2" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".08" transform="rotate(-3 12 12.5)"/>
    <line x1="9" y1="7" x2="9" y2="18" stroke={color} strokeWidth="1.2" opacity=".25" transform="rotate(-3 12 12.5)"/>
    <line x1="15" y1="7" x2="15" y2="18" stroke={color} strokeWidth="1.2" opacity=".25" transform="rotate(-3 12 12.5)"/>
    <line x1="3" y1="12.5" x2="21" y2="12.5" stroke={color} strokeWidth="1.2" opacity=".25" transform="rotate(-3 12 12.5)"/>
    <path d="M19 5l2 2.5-1.5 1" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity=".4"/>
  </svg>
);

export const LeavenIcon = ({ color = "#8B6FC0", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="7" y="8" width="10" height="12" rx="2" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".07"/>
    <rect x="6" y="6" width="12" height="3" rx="1.5" stroke={color} strokeWidth="1.5" fill={color} fillOpacity=".12"/>
    <circle cx="10" cy="4" r=".8" fill={color} opacity=".5"/>
    <circle cx="13" cy="3" r=".6" fill={color} opacity=".35"/>
    <circle cx="11.5" cy="2" r=".5" fill={color} opacity=".25"/>
    <path d="M9.5 13h5M9.5 15h3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity=".3"/>
  </svg>
);

export const NutsIcon = ({ color = "#6F9A4D", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 4C9 4 6 8 6 12.5c0 3 2.5 6.5 6 6.5s6-3.5 6-6.5C18 8 15 4 12 4z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".08"/>
    <path d="M12 6v12" stroke={color} strokeWidth="1" opacity=".2"/>
    <path d="M9 9c2 1 4 1 6 0" stroke={color} strokeWidth="1" strokeLinecap="round" opacity=".15"/>
    <path d="M8.5 13c2.5 1 5 1 7 0" stroke={color} strokeWidth="1" strokeLinecap="round" opacity=".15"/>
    <path d="M12 4c1-1.5 3-1.5 3.5 0" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill={color} fillOpacity=".1"/>
  </svg>
);

export const FatsIcon = ({ color = "#E89B48", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 11l4-3h8l4 3v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".08"/>
    <path d="M4 11l4-3h8l4 3" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M8 8v2.5" stroke={color} strokeWidth="1.2" opacity=".3"/>
    <path d="M8 11h8" stroke={color} strokeWidth="1.2" opacity=".2"/>
    <path d="M18.5 6c0 .8-.5 1.5-1 1.5s-1-.7-1-1.5.5-2 1-3c.5 1 1 2.2 1 3z" fill={color} fillOpacity=".2" stroke={color} strokeWidth="1"/>
    <path d="M14 8v11" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity=".15"/>
  </svg>
);

export const FlavorIcon = ({ color = "#2BA5B5", size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 8V5h6v3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 8h8l1 3v7a3 3 0 01-3 3h-4a3 3 0 01-3-3v-7l1-3z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity=".07"/>
    <path d="M8.5 14h7" stroke={color} strokeWidth="1.2" opacity=".25"/>
    <rect x="8.5" y="14" width="7" height="5" rx="1" fill={color} fillOpacity=".1"/>
    <path d="M15 3c2-1 4 0 4 2s-2 2-4 1" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill={color} fillOpacity=".08"/>
    <rect x="10" y="3.5" width="4" height="2" rx="1" fill={color} fillOpacity=".2" stroke={color} strokeWidth="1"/>
  </svg>
);

// Map for dynamic lookup
export const CategoryIconMap: Record<string, React.FC<IconProps>> = {
  flour: FlourIcon,
  sugar: SugarIcon,
  dairy: DairyIcon,
  choco: ChocoIcon,
  leaven: LeavenIcon,
  nuts: NutsIcon,
  fats: FatsIcon,
  flavor: FlavorIcon,
};

// Logo — inline SVG badge matching the owner's reference (red rounded rectangle
// with small top line "Toko Bahan Kue" and large bold "SANTI" below). The
// `size` prop controls the HEIGHT; the width is ~1.4× that for a landscape
// badge shape that fits the full "Toko Bahan Kue" line without cropping.
export const BakeryLogo = ({ size = 40, className = "" }: { size?: number; className?: string }) => {
  const height = size;
  const width = Math.round(size * 1.4);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 112 80"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Toko Bahan Kue Santi"
      role="img"
    >
      <rect x="2" y="2" width="108" height="76" rx="14" fill="#C4302B" />
      <text
        x="56"
        y="30"
        textAnchor="middle"
        fontFamily="Arial Narrow, Arial, sans-serif"
        fontSize="14"
        fontWeight="700"
        fill="#FFFFFF"
        letterSpacing="0.6"
      >
        Toko Bahan Kue
      </text>
      <text
        x="56"
        y="64"
        textAnchor="middle"
        fontFamily="Arial Narrow, Arial Black, sans-serif"
        fontSize="32"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="3"
      >
        SANTI
      </text>
    </svg>
  );
};
