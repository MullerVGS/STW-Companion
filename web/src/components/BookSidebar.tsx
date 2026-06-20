import { useEffect, useState } from "react";

import type { BookSection } from "../types";

interface Props {
  sections: BookSection[];
  activeSection: string;
  activeSub: string;
  /** owned count per `${sectionKey}/${subKey}` */
  ownedBySub: Record<string, number>;
  onSelect: (sectionKey: string, subKey: string) => void;
}

/** Collapsible accordion of sections → subcategories with owned progress. */
export function BookSidebar({ sections, activeSection, activeSub, ownedBySub, onSelect }: Props) {
  // only the active section is open by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [activeSection]: true });

  // keep the active section open when it changes via search / cross-link
  useEffect(() => {
    setExpanded((e) => (e[activeSection] ? e : { ...e, [activeSection]: true }));
  }, [activeSection]);

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <nav className="cb-side">
      {sections.map((sec) => {
        const open = !!expanded[sec.key];
        // section-level owned / total across its real subcategories (skip synthetic "all")
        let owned = 0;
        let total = 0;
        for (const sc of sec.subcategories) {
          if (sc.key === "all") continue;
          owned += ownedBySub[`${sec.key}/${sc.key}`] ?? 0;
          total += sc.count ?? 0;
        }
        const secDone = total > 0 && owned >= total;
        const hasActive = sec.key === activeSection;
        return (
          <div className={`cb-side-group${open ? " open" : ""}`} key={sec.key}>
            <button
              type="button"
              className={`cb-side-section${hasActive ? " active" : ""}`}
              onClick={() => toggle(sec.key)}
              aria-expanded={open}
            >
              <span className={`tw${open ? " open" : ""}`} aria-hidden>
                ▸
              </span>
              <span className="nm">{sec.label}</span>
              <span className={`ct${secDone ? " full" : ""}`}>
                {owned}/{total}
              </span>
            </button>
            {open && (
              <div className="cb-side-subs">
                {sec.subcategories.map((sub) => {
                  const o = ownedBySub[`${sec.key}/${sub.key}`] ?? 0;
                  const done = sub.count > 0 && o >= sub.count;
                  const on = sec.key === activeSection && sub.key === activeSub;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`cb-sub${on ? " act" : ""}${done ? " done" : ""}`}
                      onClick={() => onSelect(sec.key, sub.key)}
                    >
                      <span className="lbl">{sub.label}</span>
                      {done ? (
                        <span className="check" aria-hidden>
                          ✓
                        </span>
                      ) : (
                        <span className="ct">{sub.count}</span>
                      )}
                      <span className="chev" aria-hidden>
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
