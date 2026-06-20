/** Small inline SVG icons (stroke = currentColor) used by the loadout actions
 *  and inspect bar — crisper and on-theme vs. emoji glyphs. */

interface IconProps {
  size?: number;
}

interface SectionIconProps extends IconProps {
  section: string;
}

/** Compact category glyphs for the Collection Book navigation. */
export function SectionIcon({ section, size = 22 }: SectionIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (section === "heroes") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.6-4.3 2.8-6.5 6.5-6.5s5.9 2.2 6.5 6.5" />
        <path d="m8.5 4 1.2-2M15.5 4l-1.2-2" />
      </svg>
    );
  }
  if (section === "personnel") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9.5" r="2.3" />
        <path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c3.8-.8 5.9.9 6.5 4.5" />
      </svg>
    );
  }
  if (section === "ranged") {
    return (
      <svg {...common}>
        <path d="m3 14 12.5-6 2 2-4 3 6.5 1.5-1 2.5-8-1-3.5 4H4l2-5Z" />
        <path d="m9 12 2 4" />
      </svg>
    );
  }
  if (section === "melee") {
    return (
      <svg {...common}>
        <path d="m4 20 4.5-4.5M7 17l-2-2 9.5-9.5L20 4l-1.5 5.5L9 19Z" />
        <path d="m13 7 4 4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 5h16v14H4z" />
      <path d="m7 16 3-8 2 5 2-3 3 6M8 5V3M16 5V3" />
    </svg>
  );
}

/** Inspect / view details. */
export function IconEye({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Find in the Collection Book. */
export function IconBook({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5c3.5-.7 6 0 8 1.6 2-1.6 4.5-2.3 8-1.6v13c-3.5-.7-6 0-8 1.6-2-1.6-4.5-2.3-8-1.6Z" />
      <path d="M12 6.6V20" />
    </svg>
  );
}

/** Remove / clear. */
export function IconX({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
