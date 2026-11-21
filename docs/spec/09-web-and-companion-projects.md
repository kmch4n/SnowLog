# Web Preview, Landing Site and Promotional Video

## Distinguish three execution targets

1. **Mobile app (shipping iOS):** `src` with native SQLite, PhotoKit/Expo media APIs, app-owned files.
2. **Expo Web preview (development and smoke-test):** alternate modules under `src` and in-memory fixture data. It is **not** cloud-synced SnowLog and does not read the user's iPhone library.
3. **Independent promotional projects:** Astro static site (`pr/web`) and Remotion film producer (`pr/pv`). These can be built without launching the mobile application.

The word “Web” must not be used to imply that the Expo Web preview and the separately deployed marketing website are the same application.

## Expo Web preview architecture

`src/app/_layout.web.tsx` supplies browser navigation and a safe root. Expo Router can still evaluate native route modules while discovering routes. `metro.config.js` maps `expo-sqlite` and `drizzle-orm/expo-sqlite` to `src/mocks/emptyModule.js` **on Web**, so any imported native entry point calling `openDatabaseSync` would fail. `src/database/index.web.ts` explicitly avoids opening SQLite, and individual repository `.web.ts` modules replace native behavior.

The main browser data store is `src/mocks/webMockStore.ts`: deterministic-looking fixtures for video records, tags, associations, preferences, favorites, diary and technique options, with shared helpers to allocate IDs and timestamps. Web repositories implement the same surface contract against that store where practical. The dashboard Web repository invokes the **same** pure `buildDashboardStats` implementation as native, so deleting a mock video can affect the displayed statistics rather than returning fixed invented totals.

Platform-dependent services have `.web` counterparts:
- Photos/media access: unsupported/missing outcomes, no actual Photos authorization or video download.
- Import, file system, thumbnail generation/migration, storage migration and cleanup: preview-safe stubs rather than iOS media persistence.
- Haptics: deliberate no-op.
- Glass surface: browser-compatible visual alternative.
- Video detail and import screens: Web-specific routes where necessary.

Do not assume stub parity means feature parity. It means the browser can import and render the relevant modules without native crashes; unsupported actions must remain visibly distinct from production behavior.

## Web-specific interaction safeguards

React Native `Alert.alert` is bridged to a Web queue through `WebAlertHost` / `webAlertQueue` so actions with confirmations remain inspectable/clickable instead of disappearing. `webDragClickGuard` handles drag/click interactions peculiar to the browser. Navigation, translated labels, fixture records and accessible controls are targets for smoke validation, but a green browser render does not validate an iPhone's Photos library, iCloud, file permissions or native player.

`scripts/tests/webShimParity.test.cjs` statically checks that `.web` companions export at least the native module surface. `webEmptyModules.test.cjs` ensures modules replaced by Metro's empty shim are not imported from a Web module without a safe companion. `npm run test:web` exports the Web bundle and runs `scripts/webSmoke.cjs`, which launches headless Chrome, visits named routes and checks visible content/error boundaries.

## Astro static marketing website (`pr/web`)

A distinct npm project, currently Astro **6** with TypeScript and `@astrojs/sitemap`, configured with `output: "static"`. `astro.config.mjs` sets site `https://snowlog.kmchan.jp` and redirects old `/ja` and `/en` paths to the current Japanese-only root/privacy paths.

| File/module | Role |
| --- | --- |
| `src/pages/index.astro` | Routes homepage to `HomeDocument` |
| `src/pages/privacy.astro` | Routes privacy page to `PrivacyDocument` |
| `src/content.ts` | Typed Japanese home and privacy content |
| `src/i18n.ts` | Content structures, navigation paths, App Store and GitHub URLs |
| `src/components/AppHero.astro` | Hero and product introduction |
| `src/components/FeatureGrid.astro` | Features |
| `src/components/ScreenshotShowcase.astro` | App screenshots |
| `src/components/OfflinePrivacySection.astro` | Offline/privacy presentation |
| `src/components/FaqSection.astro` | FAQs |
| `src/components/PrivacyDocument.astro` | Privacy/legal content presentation |
| `src/styles/global.css` | Site styling and responsive behavior |
| `public/` | Badge, icon, manifest, robots and a promotional-video export |

Available commands are `npm run dev`, `npm run build` and `npm run preview` **from `pr/web`**. The repo contains `public/videos/snowlog-pv-1080p.mp4` and a poster image, but its presence **does not prove a currently deployed website serves the current bytes**. Deployment must be checked separately; there is no automatic equivalence between the repo and the public host. Do not claim the deployed site embeds the video without checking its actual release.

## Remotion promotional video (`pr/pv`)

A separate Remotion **4** + React project builds a SnowLog product film. Primary source ownership:

| Source | Responsibility |
| --- | --- |
| `src/script.ts` | Typed scene definitions, on-screen text, narration paths and minimum durations |
| `src/timeline.ts` | Probe narration durations, derive frame lengths/offsets; calculate total frames |
| `src/Root.tsx` | Compositions: 60fps, 1920x1080, full film and per-scene previews |
| `src/SnowLogPv.tsx` | Sequence assembly, video/music/captions |
| `src/scenes/S00Title.tsx` through `S09Cta.tsx` | Ten scene components |
| `src/components/` | Device frame, transitions, snow effects, captions |
| `src/tiles.ts` / `src/theme/` | Layout and visual tokens |
| `scripts/generate-narration.mjs` | Narration production |
| `scripts/prepare-assets.sh` / `export-web.sh` | Asset preparation and Web export |
| `scripts/voiceprint.py` and audio checks | Recorded production/verification utilities |

Scene duration is the **maximum of scripted minimum and measured narration duration**. Narration is resolved independently per scene; missing audio is handled at scene level. The full composition's fallback duration derives from minimum scripted time, then asynchronous composition metadata calculates actual frames. Background audio presence is independently detected.

`remotion.config.ts` selects H.264/CRF 16, JPEG intermediates at quality 100, a 2 GiB offthread-video cache and configured render concurrency. These are production parameters, not requirements for the iOS runtime.

Common commands from `pr/pv`: `npm run studio`, `npm run render` and `npm test`. Video tests cover script consistency, tiles, scenes and timeline. Movie export to the website is an explicit pipeline step; do not treat modifying Remotion sources as equivalent to deploying the Astro website.

## Publication boundaries

- The App Store application, Astro host and README video are independently published surfaces.
- An asset present in a repository branch is not evidence it is live.
- Update cross-surface claims only when the corresponding production artifact is actually deployed and verified.
- Keep privacy representations consistent with actual app behavior, especially the distinction between local metadata, optional App Store lookup and iCloud/Photos acquisition.

**Evidence:** `src/app/_layout.web.tsx`, `src/database/*.web.ts`, `src/database/repositories/*.web.ts`, `src/services/*.web.ts`, `metro.config.js`, `scripts/webSmoke.cjs`, `pr/web/`, `pr/pv/`.
