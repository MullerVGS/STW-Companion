# Curated weapon/trap perk icons

Most weapon/trap perks (alterations) ship **no icon** in the BanjoBotAssets
export — only elemental ones do (those resolve automatically to the on-disk
`T-Icon-Element-*` art). To give the stat perks proper iconography, drop a
`<statType>.png` (or `.webp`) here, where `<statType>` is the perk family's stat
segment (see `STAT_PERK_ICON` / `perkStatType()` in `data/src/import-banjo.ts`).

The build resolves these by path; a missing file is silently skipped (the UI
falls back to a letter badge), so it's safe to populate incrementally.

Suggested filenames (cover the common weapon/trap perks):
critchance, critdamage, damage, headshotdamage, magazinesize, reloadspeed-ranged,
reloadspeed-trap, firerate-ranged, stability, maxdurability, maxdurability-trap,
weaponimpact, knockbackimpact, traprange, effectduration, healing,
buildingheal, buildingmaxhealth, damage-physical.
