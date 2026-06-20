/** Bold the numbers / percentages / dotted acronyms inside perk + ability +
 *  gadget text, like the in-game tooltips. Shared by InspectModal, SlotPicker
 *  and the loadout Team Summary. */
export function Rich({ text }: { text?: string }) {
  if (!text) return null;
  const parts = String(text).split(
    /(\+?-?\d[\d,.]*\s?%?|\bD\.E\.C\.O\.Y\.|\bB\.A\.S\.E\.|\bR\.O\.S\.I\.E\.|\bT\.E\.D\.D\.Y\.)/g,
  );
  return (
    <>
      {parts.map((p, i) =>
        /^[+-]?\d/.test(p) || /\.[A-Z]\./.test(p) ? <b key={i}>{p}</b> : <span key={i}>{p}</span>,
      )}
    </>
  );
}
