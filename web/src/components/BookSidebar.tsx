import type { BookSection } from "../types";
import { SectionIcon } from "./icons";

interface Props {
  sections: BookSection[];
  activeSection: string;
  onSelect: (sectionKey: string) => void;
}

/** Flat in-game-style Collection Book section navigation. */
export function BookSidebar({ sections, activeSection, onSelect }: Props) {
  return (
    <nav className="cb-side" aria-label="Collection Book sections">
      <div className="cb-side-label">Collection categories</div>
      {sections.map((sec) => (
        <button
          key={sec.key}
          type="button"
          className={`cb-side-section${sec.key === activeSection ? " active" : ""}`}
          onClick={() => onSelect(sec.key)}
          aria-current={sec.key === activeSection ? "page" : undefined}
        >
          <span className="si">
            <SectionIcon section={sec.key} />
          </span>
          <span className="nm">{sec.label}</span>
          <span className="chev" aria-hidden>
            ›
          </span>
        </button>
      ))}
    </nav>
  );
}
