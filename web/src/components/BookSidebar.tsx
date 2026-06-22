import { useEffect, useState } from "react";

import type { BookSection } from "../types";
import { SectionIcon } from "./icons";

interface Props {
  sections: BookSection[];
  activeSection: string;
  activeDivision: string;
  onSelect: (sectionKey: string, divisionKey: string) => void;
}

/** Expandable Collection Book navigation: category → in-game page/division. */
export function BookSidebar({
  sections,
  activeSection,
  activeDivision,
  onSelect,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(activeSection);

  useEffect(() => {
    setExpanded(activeSection);
  }, [activeSection]);

  const toggleSection = (section: BookSection) => {
    if (section.key === activeSection) {
      setExpanded((current) => (current === section.key ? null : section.key));
      return;
    }
    setExpanded(section.key);
    onSelect(section.key, section.divisions[0]?.key ?? "all");
  };

  return (
    <nav className="cb-side" aria-label="Collection Book sections">
      <div className="cb-side-label">Collection categories</div>
      {sections.map((sec) => {
        const open = expanded === sec.key;
        const active = sec.key === activeSection;
        return (
          <div className={`cb-side-group${open ? " open" : ""}`} key={sec.key}>
            <button
              type="button"
              className={`cb-side-section${active ? " active" : ""}`}
              onClick={() => toggleSection(sec)}
              aria-expanded={open}
            >
              <span className="si">
                <SectionIcon section={sec.key} />
              </span>
              <span className="nm">{sec.label}</span>
              <span className={`chev${open ? " open" : ""}`} aria-hidden>
                ›
              </span>
            </button>
            {open && (
              <div className="cb-side-subs">
                {sec.divisions.map((division) => {
                  const selected = active && division.key === activeDivision;
                  return (
                    <button
                      key={division.key}
                      type="button"
                      className={`cb-sub${selected ? " act" : ""}`}
                      onClick={() => onSelect(sec.key, division.key)}
                      aria-current={selected ? "page" : undefined}
                    >
                      <span className="lbl">{division.label}</span>
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
