# Settings, Localization, and UI Presentation Contracts

## Settings route inventory

`src/app/(tabs)/settings/index.tsx` presents five navigable settings destinations and one in-place maintenance action:

| Destination | Route / owner | Behavior |
| --- | --- | --- |
| Calendar | `src/app/settings/calendar.tsx` | Choose Monday/Sunday as the week start; store `weekStartDay` |
| Techniques | `src/app/settings/techniques.tsx` | Add, remove and drag-reorder technique choices |
| Favorite resorts | `src/app/settings/favorite-resorts.tsx` | Add/remove resort suggestions for quick entry |
| Tags | `src/app/settings/tags.tsx` | Create/delete user-defined custom tags |
| Duplicate candidates | `src/app/settings/duplicate-candidates.tsx` | Review probable duplicate groups and selectively delete records |
| Unused-file cleanup | In-place Settings row | Confirm, run orphan scan, report count and byte reclamation |

The settings page also conveys backup/uninstall limitations. The **media-priority selection screen described in Issue #86 is not present** at this baseline; do not list it as a shipping setting.

## Calendar and technique settings

`useAppPreference("weekStartDay", "monday")` loads the selected value on focus and persists changes as strings. Existing historical use of camelCase is intentional; renaming the key without migration loses the user's choice.

`technique_options` owns the selectable technique master. `insertTechniqueOption` appends after the highest existing `sortOrder`, rather than using row count. `reorderTechniqueOptions` updates all orders in one synchronous DB transaction. `deleteTechniqueOption` removes the menu choice only; already saved `videos.techniques` JSON retains the name. `TechniqueSelector` renders selected-but-removed labels so they remain visible and removable. Seed defaults (`DEFAULT_TECHNIQUE_OPTIONS`) are added incrementally using the persisted `technique_defaults_seeded` record; a user-deleted default must not return on every launch.

## Resort and tag settings

Resort favorites are string names with a uniqueness constraint. They support suggestions; they do not rewrite a video's existing resort name. `SkiResortSearch` draws from the bundled resort master, favorites, recent and same-day suggestions, and manual input.

Tag types are `technique`, `skier` and `custom`. The tag management screen is focused on user-defined custom tags. `tagRepository.deleteCustomTag` verifies type **before** deleting any links, then deletes `video_tags` links and the tag in a synchronous transaction. Removing a custom tag therefore removes that association from every video; it is not merely a UI hide operation.

## Duplicate-candidate inspection

`duplicateDetectionService.detectDuplicateCandidates` analyzes candidate videos using length difference, capture-time proximity, normalized filename similarity and resort-name equality. Filename normalization removes common suffixes and preserves Unicode letters/numbers. Common generic names (`video`, `movie`, `fullsizerender`) provide no filename-match evidence.

Pair scoring currently includes:

| Signal | Score contribution |
| --- | --- |
| Duration exactly equal | +2 |
| Duration difference at most 1 second | +1 |
| Capture timestamps exactly equal | +3 |
| Capture difference at most 5 seconds | +2 |
| Capture difference at most 60 seconds | +1 |
| Normalized filename exact | +3 |
| Strict partial filename match | +1 |
| Same nonempty resort | +1 |

A pair qualifies if filenames match and durations differ by at most 2 seconds, **or** capture timestamps differ by at most 5 seconds and durations by at most 1 second, **or** total score is at least 5. Comparison scans a time-local window and shared exact-filename buckets.

Qualified pairs form an **undirected connected graph**. Connected components of size at least 2 become groups, ordered by best similarity and size. A group's highest pair score ≥7 implies `high` confidence, otherwise `medium`. Confidence is an estimate, not proof that two movies are identical. The UI presents candidate groups with reasons and explicit selection/deletion; it must not auto-delete solely from the score. Actual deletions use the shared DB-first cleanup service.

## Localization contract

- `src/i18n/index.ts` initializes `i18n-js` with Japanese/English resources; it reads `expo-localization.getLocales()[0]?.languageCode` **once**. Language code `ja` selects Japanese; other codes select English. There is **no** in-app language switch and no dynamic subscription.
- React uses `useTranslation()` to obtain `{ t, locale }`; non-React code can import `t` from the module.
- `src/i18n/locales/ja.ts` is the reference shape; `en.ts` is typed against it. Both should receive matching keys and interpolation semantics when features change.
- Permissions text uses **separate** root `locales/ja.json` / `locales/en.json` via `app.json` locale configuration. The inline Japanese `infoPlist` strings are fallbacks, not replacement for localized plist values.
- End-user language is independent of documentation language: English-only `docs/spec/` does **not** mean removing Japanese app localization or historical Japanese documents.

## Visual conventions and feedback

`src/constants/colors.ts` defines the Alpine Blue palette, neutral backgrounds, text levels, semantic tag colors, error/success and resort-dot colors. `src/constants/icons.ts` centralizes SF Symbol/Material icon mappings. Use these tokens rather than introducing separate per-screen palettes.

`GlassSurface` renders Expo Liquid Glass when the platform API is available (notably iOS 26+); otherwise a branded opaque View remains legible. The Web companion always uses the opaque fallback. The iOS tab navigator uses Expo Router `NativeTabs` and platform icons. A screen should not assume the latest iOS-only glass behavior works on older supported iOS versions.

`src/constants/motion.ts` supplies shared default and momentum spring configurations, layout transitions, and press feedback (`PressableScale`). Respect the system Reduced Motion expectations; inspect `.memory/apple-design-rn.md` for deeper design rationale.

`hapticsService` wraps Expo haptics, swallowing native unavailability errors so a missing/older binary does not crash UI work. Use the centralized functions (`hapticLight`, `hapticMedium`, `hapticSelection`, `hapticSuccess`, `hapticWarning`, `hapticError`); direct `expo-haptics` imports outside this service are disallowed by lint rules.

## Accessibility and Web-specific interaction

Some interactive elements already have accessible roles/labels (e.g., day cells and icons), but **the code does not establish universal VoiceOver coverage**. New touch targets need labels/roles and must be checked on device. Issue history includes accessibility follow-up work; do not describe this as fully audited.

Web alerts are replaced with a custom host because React Native Web's `Alert.alert` implementation is ineffective; mouse drag clicks need an additional guard to prevent unintended video opening. Web list reordering can require a platform-specific gesture workaround. These are implementation compatibility measures, not parity with native iOS.

## Maintenance action

The Settings cleanup row runs only after a confirmation. While running, repeated taps are guarded. Success reports removed file counts (including a zero-deletions message), failure reports the error, and warning/success/error haptics match the stage. Details of the actual file-protection invariants are in [Library and playback](library-and-playback.md).

## Sources

`src/app/(tabs)/settings/index.tsx`; `src/app/settings/*.tsx`; `src/components/{TechniqueSelector,SkiResortSearch,TagSelector,VideoCardCompact}.tsx`; `src/services/duplicateDetectionService.ts`; `src/constants/{colors,motion,icons,techniques,diaryOptions}.ts`; `src/i18n/index.ts`; `src/i18n/useTranslation.ts`; `src/services/hapticsService.ts`; `src/database/repositories/{techniqueOptionRepository,tagRepository,favoriteResortRepository}.ts`.
