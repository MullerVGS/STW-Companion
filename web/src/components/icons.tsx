/** Small inline SVG icons (stroke = currentColor) used by the loadout actions
 *  and inspect bar — crisper and on-theme vs. emoji glyphs. */

interface IconProps {
  size?: number;
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
