# Forma 151-species 3D Pokédex

The companion page includes every Kanto species #001–#151 as a locally served, textured, skinned GLB, preserving all 869 upstream animation clips. Munchlax #446 and the six legacy character IDs remain compatible. The catalog uses Chinese/English/number search, type filtering and 24 cards per page; only the selected GLB is fetched. Portrait cards are thumbnails, while the main stage renders the actual 3D model.

## Reproducible import

Upstream: https://github.com/06wj/pokemon at `00d96f7f18894055e7f1db44fa0df6462e5e4c8a`. Chinese names, types, animation metadata, models and icons are pinned to this revision. English display names originate from the PokeAPI first-151 list, with punctuation normalized. Committed `src/catalog/pokemon.json` is the runtime catalog; no remote model or API requests are made at runtime.

Run `node scripts/import-pokemon-catalog.mjs <public-asset-cache-directory>` to download and prepare assets. The cache must be outside the checkout. The importer preserves all clips, verifies their names against upstream metadata, caps textures at 512px, and writes per-model source/output SHA-256 hashes to `public/companions/model-manifest.json`. Each GLB is below 3 MB. Existing high-resolution portraits remain; newly imported portraits use the pinned 3D icons. Software licensing does not independently grant character rights; notices remain in `public/licenses/`.

## Selection and evolution

New persisted IDs are `pokemon-1` through `pokemon-151`, alongside the six legacy IDs. Selecting a card changes the chosen companion, preserving XP, quests, chests, outfits and challenges. The demo only previews. Every catalog species is available as a starting form; remaining Kanto evolutions occur at Forma levels 3 and 5, without reproducing game trade/item mechanics. Eevee keeps the existing Flareon path; Vaporeon and Jolteon can be selected directly. Species with no later Kanto form keep their appearance as levels grow. Future-form previews never award XP.

The animation menu exposes only the current model's authored clips. Native walk/sleep buttons are disabled when absent. Munchlax retains its explicitly locally authored four bone actions. Run/walk return to idle after two loops; happy/attack return after one playback. Animation pause, reduced motion, offscreen suspension, GPU disposal and fetch cancellation remain supported.

## Additive SQLite migration

Startup adds nullable `companion_profiles.pokemon_character`, restricted to the 151 valid IDs. The original `character` CHECK column remains unchanged, preserving all legacy choices without rebuilding the table. Snapshot reads prefer the new column; selecting a legacy companion clears it. Migration checks the column again inside `BEGIN IMMEDIATE` and is idempotent. It never changes health records or XP. An older release ignores the new column and shows the retained legacy companion; returning to this release restores the selected catalog species. Do not drop the column on rollback.

## Verification

`npm test` validates every packaged model/hash, all 869 real animation clips, geometry/camera framing, portraits, account isolation, 151-species persistence, invalid-ID rejection and both legacy schema migrations. `npm run build` also validates all 5,632 exercise videos and thumbnails.

`node scripts/companion-portrait-studio.mjs` opens an authoring-only UI at `http://127.0.0.1:5191/`. Its explicit full-catalog button loads all 151 models through the production loader, checks decoded textures and skeletons, and renders each of the 869 clips with WebGL. This tool is not part of the user-facing build.
