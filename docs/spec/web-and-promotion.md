# Expo Web Preview and Standalone Promotional Projects

## Three independent execution surfaces

SnowLog includes three different web-related surfaces that must not be conflated:

| Surface | Location | Purpose | Runtime / storage |
| --- | --- | --- | --- |
| Expo Web preview | Root Expo app, platform `.web.ts(x)` files | Test app navigation, data presentation and browser-safe interactions | React Native Web, in-memory mock; not a shipping multi-device client |
| Promotional website | `pr/web/` | Static public landing page and privacy notice | Astro, static HTML/CSS/assets, no local app SQLite |
| Promotional film | `pr/pv/` | Produce marketing video assets | Remotion and supporting media scripts, independent Node package |

A successful website build says nothing about iOS app correctness; a successful Expo Web smoke test says nothing about native PhotoKit behavior; and committed video assets do not prove the public server has been redeployed.

## Expo Web entrypoints

`src/app/_layout.web.tsx` replaces the native root and deliberately **does not** execute Drizzle migrations or native file-migration routines. Browser routing still uses Expo Router and renders familiar tabs where feasible.

A platform-specific module may need a `.web.ts` or `.web.tsx` implementation **even when its UI route has a Web companion**: the Expo Router route loader can evaluate imports from the native layout to discover route metadata. A previous Web build passed bundling yet failed at runtime because `expo-sqlite.openDatabaseSync` was invoked in the browser. `src/database/index.web.ts` now exports a nonfunctional DB placeholder solely to avoid the native import side effect; callers must use corresponding Web repository shims.

`metro.config.js` supplies platform-specific native-module substitutes. Many `src/database/repositories/*.web.ts` files operate through the shared `src/mocks/webMockStore.ts`; they imitate meaningful application behavior for manual navigation and smoke tests, not disk persistence or database transaction semantics.

## Mock-store and route behavior

- Browser data exists only for the running preview session; it is **not** a backup, cloud sync, or an alternative iOS data location.
- Web repositories should reflect the native module's **public exports and return types**, while describing unsupported operations explicitly. Silent omission produces runtime failures even when TypeScript succeeds.
- `src/app/video-import.web.tsx` intentionally renders an unsupported-import message; importing via browser is not a product feature.
- `src/app/video/[id].web.tsx` is a simplified detail/preview surface and cannot verify native `expo-video` playback, permissions or filesystem paths.
- `src/components/WebAlertHost.tsx` installs a custom alert queue to replace ineffective `Alert.alert` on React Native Web. `src/utils/webDragClickGuard.ts` suppresses accidental click-through after mouse dragging.
- `src/components/ui/GlassSurface.web.tsx` renders opaque brand-colored surfaces rather than requiring native Liquid Glass.

### Web parity checks

`scripts/tests/webShimParity.test.cjs` inspects export parity between native modules and Web substitutes; `webEmptyModules.test.cjs` checks expected harmless native-module replacements. `npm run test:web` runs an Expo Web export and launches **headless Chrome** through `scripts/webSmoke.cjs`, checking rendered route markers and detecting an error-boundary-only startup. This is more meaningful than bundling alone but does not prove every user action or device behavior.

Adding a new native-dependent module requires checking imports reachable through Web, adding or updating Web shims, and exercising the actual route/action. A type-check alone is insufficient because Metro chooses a different platform file at bundle/runtime.

## Astro promotional website

`pr/web/package.json` defines an independent Astro 6 project with `npm run dev`, `npm run build` and `npm run preview`. It produces a **static** site, configured in `pr/web/astro.config.mjs` for `https://snowlog.kmchan.jp` and a sitemap integration.

The site is currently **Japanese-language content**, as implemented in `pr/web/src/content.ts` and `src/components/HomeDocument.astro` (`html lang="ja"`). Old `/ja` and `/en` URL variants redirect to the current root, and the corresponding privacy routes redirect to `/privacy/`. The site's Japanese presentation is **not** in conflict with the requirement that the new implementation specifications be English.

| Website path / module | Responsibility |
| --- | --- |
| `src/pages/index.astro` | Renders `HomeDocument` with `homeContent` |
| `src/pages/privacy.astro` | Renders `PrivacyDocument` with `privacyContent` |
| `src/content.ts` | Copy, feature cards, screenshots, FAQ and privacy content |
| `src/i18n.ts` | Typed content interfaces, App Store/GitHub URLs, canonical paths |
| `src/components/AppHero.astro` | Header/nav, App Store CTA and embedded PV player |
| `src/components/FeatureGrid.astro` / `ScreenshotShowcase.astro` | Feature presentation and screenshots |
| `src/components/OfflinePrivacySection.astro` | Local-first narrative |
| `src/components/PrivacyDocument.astro` | Static privacy policy, contact link |
| `src/styles/global.css` | Global visual system and responsive presentation |

Website metadata includes canonical URLs, social preview tags and `SoftwareApplication` JSON-LD. The privacy document and product marketing are **public claims** and must be rechecked when storage, network behavior or backup semantics change. In particular, “Photos references” is the default for most current imports but synthetic imports hold managed copies; avoid unconditional “movies are never copied” claims.

`pr/web/public/videos/snowlog-pv-1080p.mp4` and poster imagery are referenced by `AppHero.astro` using `/videos/` paths. The media file is present in source, but the deployed website may be older than the repository. Do not claim live availability without an independent deployment check.

## Remotion promotional video project

`pr/pv/` has its own `package.json`, lockfile, configuration, public assets, scene components and test suite. Runtime scripts:

| Command (run from `pr/pv/`) | Action |
| --- | --- |
| `npm run studio` | Remotion Studio |
| `npm run render` | Render `SnowLogPv` into `out/snowlog-pv.mp4` |
| `npm test` | Validate scene, script and timeline behavior |

`src/script.ts` is the **single source of truth** for scene identifiers, narration text, on-screen captions, minimum durations, tails, and chosen transitions. Changing a spoken/caption line in an individual scene without updating this registry creates drift.

`src/timeline.ts` measures actual narration using `mediabunny` and computes the duration of each scene as the maximum of its minimum and the spoken duration plus lead-in/tail. Missing narration files are an explicitly supported prerecording state. `distributeFrames` allocates integer frame budgets using cumulative rounded edges, preventing short gaps between clips due to independent rounding.

`src/SnowLogPv.tsx` registers the scene components, renders `Sequence` blocks, adds narration only for the scenes whose files exist, overlays transitions over scene boundaries, and ducks the background track during speech. Layout, transition and typography components are under `src/components/` and `src/theme/`. Narration generation and asset preparation live under `scripts/` and are separate from the mobile build.

The site consumes the **rendered output**, not the Remotion source directly. Changes to promotion copy and scene timing should be validated through the Remotion tests/render and then separately deployed if requested.

## Integration and deployment boundaries

- The root app package, Astro package and Remotion package have **independent dependency locks**. Do not run their scripts from the wrong directory or assume root `npm ci` installs all nested dependencies.
- Updating the repository does **not** redeploy `snowlog.kmchan.jp`, publish a mobile release or upload a new promotional film.
- No static-site or video-source change authorizes production deployment. Follow deployment/release procedures with explicit approval.
- A documentation-only PR should not alter built videos, screenshots, dependency locks, deployment targets or marketing claims unless they are within its accepted scope.

## Sources

`src/app/_layout.web.tsx`; `src/app/video-import.web.tsx`; `src/app/video/[id].web.tsx`; `src/database/index.web.ts`; `src/mocks/webMockStore.ts`; `src/components/WebAlertHost.tsx`; `src/utils/webDragClickGuard.ts`; `metro.config.js`; `scripts/webSmoke.cjs`; `pr/web/{package.json,astro.config.mjs,src/content.ts,src/i18n.ts,src/pages/,src/components/}`; `pr/pv/{package.json,src/script.ts,src/timeline.ts,src/SnowLogPv.tsx}`.
