# Forma companion island

The companion page opens a full-screen, locally built 3D island at `/companion-island/`. It adapts the MIT software in `06wj/pokemon` revision `00d96f7f18894055e7f1db44fa0df6462e5e4c8a`; upstream license, notices, environment credits and original tests remain in `vendor/pokemon-island`. The original simulation, actions, weather, navigation, effects, audio, capture and journal implementations are preserved. The design catalog's unimplemented ideas are not presented as working behaviors.

## Behavior coverage

- Base motion and society: exploration, walking/running, habitat visits, legal river travel, greeting, rest, family sleep, wake and pet reactions.
- Food: natural fruit drops/ripening, player throws, finite inventory, sniffing/bites, satiety, waiting and yielding to a hungrier neighbor.
- Fire: Charmander inspects prepared wood, aims, breathes fire, steps back; companions gather, linger, circle and sometimes nap.
- Water/garden: Squirtle inspects the river, takes water, carries it ashore and waters flowers. Other residents notice the refreshed garden.
- Flowers/electricity: Pikachu smells flowers, sometimes sneezes and performs a brief electrical display; nearby residents turn, react, smile or give space.
- Weather and sleep: dawn/dusk, rain/snow, gradually accumulating/melting snow, shelter or weather curiosity, quiet naps, gentle sleeping murmurs and noise waking.
- Player tools: observe, fruit, shake tree, prepare wood, rustle flowers, follow/pet, capture, album/discovery journal, sound, pause and restart.

The 20 upstream residents retain their authored abilities. A selected Kanto companion not already in the cast joins as a 21st resident. The 151-form catalog remains available on the main companion page. Munchlax, outside this catalog, uses its Snorlax family representative in the island. Species-specific fire/water/electric scenes retain the original actors and conditions.

## Integration

The main page does not load the island engine until opened. It pauses its single-companion render loop while the island is open. Returning destroys the iframe and resumes the existing companion scene; it does not change selected identity, XP, levels, outfits or health records. Incoming close messages must match both the local origin and exact iframe window. The background app is inert while the modal is open.

The island reuses `/companions/models/{dex}.glb` and the existing portraits. A small loader adapter resolves WebP texture indices for Hilo3D in memory; it preserves the original model geometry, buffers, images and animation clips. No duplicate Pokémon model library, remote iframe, CDN, Google font request or health API integration is used. The island's environment assets are local. The WebGL2 backend is selected for broad browser support.

Journal/audio storage is prefixed `forma-island:{accountId}:`. Demo journals use session storage. Local virtual photos and discoveries persist across reloads for that account; they are not cloud-synchronized. Account deletion removes only that account's island keys. Opening or feeding the world never awards XP or reads health records. Reduced-motion preference starts the island paused; the user can explicitly resume.

## Build and checks

Install `npm ci --prefix vendor/pokemon-island` once. `npm run build` typechecks and builds the island after the training workbench, includes corresponding vendor source in the source archive, and records its pinned source/behavior coverage in `release-info.json`. Docker installs the vendor lockfile in its build stage. The static scene assets are cached on demand; they are not all downloaded during shell installation.

From the project root, run `npm test` and `npm --prefix vendor/pokemon-island run test:living`. In `vendor/pokemon-island`, also run `node scripts/test-ecology.mjs`. Upstream suites cover action sequencing, finite fruit, one consumer, shared food, weather, terrain/body clearance, reactions, motion, audio lifecycle, capture attribution and journal quota/recovery. Root tests cover account namespaces, cleanup, valid selected residents and existing companion/health invariants. Rendered QA should exercise desktop/mobile entry/exit, current companion presence, native stories, weather, pet/follow, photo/reload, pause and browser console health.
