import { SchematicCard } from "./SchematicCard";
import type { Schematic } from "../types";

interface Props {
  schematics: Schematic[];
  selectedTags: ReadonlySet<string>;
  onToggleFacet: (tagId: string) => void;
}

export function SchematicGrid({ schematics, selectedTags, onToggleFacet }: Props) {
  if (schematics.length === 0) {
    return <p className="empty">No schematics match these filters.</p>;
  }
  return (
    <div className="grid">
      {schematics.map((s) => (
        <SchematicCard
          key={s.id}
          schematic={s}
          selectedTags={selectedTags}
          onToggleFacet={onToggleFacet}
        />
      ))}
    </div>
  );
}
