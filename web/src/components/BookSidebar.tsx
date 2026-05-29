import { useState } from "react";

import type { BookSection } from "../types";

interface Props {
  sections: BookSection[];
  activeSection: string;
  activeSub: string;
  /** owned count per `${sectionKey}/${subKey}` */
  ownedBySub: Record<string, number>;
  onSelect: (sectionKey: string, subKey: string) => void;
}

export function BookSidebar({ sections, activeSection, activeSub, ownedBySub, onSelect }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ [activeSection]: true });
  const isOpen = (key: string) => open[key] ?? key === activeSection;

  return (
    <aside className="book">
      <div className="book-title">Collection Book</div>
      {sections.map((section) => (
        <section key={section.key} className="book-section">
          <button
            type="button"
            className="book-section-head"
            onClick={() => setOpen((p) => ({ ...p, [section.key]: !isOpen(section.key) }))}
            aria-expanded={isOpen(section.key)}
          >
            <span>{section.label}</span>
            <span className="book-caret">{isOpen(section.key) ? "▾" : "▸"}</span>
          </button>
          {isOpen(section.key) && (
            <div className="book-subs">
              {section.subcategories.map((sub) => {
                const owned = ownedBySub[`${section.key}/${sub.key}`] ?? 0;
                const complete = owned >= sub.count && sub.count > 0;
                const active = section.key === activeSection && sub.key === activeSub;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    className={`book-sub${active ? " is-active" : ""}${complete ? " is-complete" : ""}`}
                    onClick={() => onSelect(section.key, sub.key)}
                  >
                    <span className="book-sub-label">{sub.label}</span>
                    <span className="book-sub-count">
                      {complete ? "✓" : `${owned}/${sub.count}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </aside>
  );
}
