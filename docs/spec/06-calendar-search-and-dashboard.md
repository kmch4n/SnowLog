# Calendar, Diary, Search, Dashboard and Duplicate Detection

## Common date conventions

`capturedAt` is an epoch timestamp in seconds; date grouping is based on the **device's local calendar date** (`dateUtils.toDateKey`). The reporting season is **October 1 to September 30 of the following year**, not November–May. `SEASON_START_MONTH = 10` and `buildSeason(startYear)` creates an inclusive period from local October 1 midnight to local September 30 23:59:59. The current-season search preset uses the same definition. This 12-month period assigns every capture date to exactly one season (fixes the gap documented in #89).

A ski day in the dashboard means **one distinct local date with at least one video**, not GPS-confirmed resort attendance, diary activity or a manually entered outing.

## Calendar

`src/app/(tabs)/calendar/index.tsx` uses `useCalendarEnhanced` for:
- Month grid and week strip, with navigation between months/weeks.
- Monday/Sunday first weekday based on persisted `weekStartDay`, default Monday.
- Video grouping by local `dateKey`, displaying count, representative thumbnail, distinct resort dots (up to three) and a diary marker.
- Day selection, showing videos from that day and a diary card.
- Switching between month/week modes while retaining a sensible anchor; navigation resets selected day as appropriate.
- Diary markers loaded from `diaryEntryRepository.getDiaryDateKeysInRange` even for days that have **no videos**.
- `useDiaryEntry` for a selected date: load, upsert, delete and refresh list indicator.

The UI presents week numbers and date headings using locale-specific formatters. It does not store per-day videos in a separate calendar table; calendar data is derived from `videos.captured_at`.

## Daily diary

One row per `diary_entries.date_key` (`YYYY-MM-DD`). The editor supports:

| Field | Representation | Notes |
| --- | --- | --- |
| Resort | Nullable free text | Search suggestions available |
| Weather | Nullable option value | Choices provided by `WEATHER_OPTIONS` |
| Snow conditions | Nullable JSON array of selected options | More than one condition may be selected |
| Impressions | Text, default empty | Core journal content |
| Temperature | Nullable integer °C | Optional |
| Companions | Nullable free text | Optional |
| Fatigue | Nullable integer 1–5 | UI option scale |
| Expenses | Nullable integer JPY | Optional |
| Number of runs | Nullable integer | Not inferred from video count |

`DiaryEditModal` places common fields prominently and additional fields in an expandable section. The editor **autosaves on close** if content exists; when an existing entry is cleared completely, it asks for deletion confirmation instead of creating an empty row. Repository `upsertDiaryEntry` performs upsert on date key; deleting a diary does not delete videos. The calendar refreshes day markers when diary changes.

## Search and filter semantics

Search UI (`src/app/(tabs)/search/index.tsx` and `FilterBar`) supports text, resort, tag chips, and date presets (current month, previous month, current season), plus clear/reset controls. Text input keeps a draft and applies a **400-ms debounce**, avoiding a query on every keystroke. A filter can also arrive from dashboard navigation via `searchRouteParams`.

Repository `getVideosByFilter` combines all populated filter dimensions with logical **AND**:
- `skiResortName` exact equality when specified.
- Inclusive Unix-second `dateFrom` / `dateTo`.
- `favoritesOnly` == 1, if requested.
- `tagIds`: obtain IDs whose associations match any selected tag ID, then restrict the video list. The tag-subquery behaves as **OR across selected IDs**, not requiring every tag; subsequent outer filters are ANDed.
- `searchText`: SQL escaped `LIKE '%text%'` across filename **or** optional title **or** memo. Percent, underscore and backslash are escaped so literal video filenames such as IMG_0123 can match correctly.
- Output ordered by capture timestamp descending before UI-specific Home sorting.

The SQLite `LIKE` implementation is case-insensitive for ASCII under normal defaults; do not claim full Unicode case-folding or tokenized/full-text indexing. The raw filter API supports favorites although the Search UI need not show the same All/Favorites segment as Home.

## Dashboard

`useDashboard` determines available seasons from the oldest imported capture timestamp through the current season, tracks user selection and loads data from `dashboardRepository.getDashboardStats`. SQLite selects lean per-season rows for aggregate processing and at most five recent full rows. The pure `buildDashboardStats` function is shared with Web preview to avoid inconsistent formulas.

| Output | Definition |
| --- | --- |
| `summary.totalSkiDays` | Count of distinct local date keys with video |
| `summary.totalVideoCount` | Number of videos in selected season |
| `summary.totalDurationSeconds` | Sum of persisted video durations |
| `summary.uniqueResortCount` | Distinct **non-empty** resort names |
| `summary.favoriteCount` | Videos with favorite flag 1 |
| `resortRanking` | Per resort: distinct visit dates, video count, latest capturedAt; sort by visit days then video count |
| `techniqueDistribution` | Counts each technique name on each video; a multi-technique video contributes to several categories |
| `monthlyTrend` | Twelve months including zero-activity months; per month video count and distinct ski days |
| `heatmapDays` | Counts videos per local date, ordered chronologically |
| `recentVideos` | Up to five latest season videos; techniques parsed and tags attached in hook |

Charts include summary cards, resort/technique horizontal bar charts, monthly metric bars and a scrollable activity heatmap. Relevant cards and chart elements can navigate to Search with a matching filter. The heatmap is a density of **video records**, not measured ski mileage or run quality.

## Duplicate candidate algorithm

`duplicateDetectionService.detectDuplicateCandidates` works on existing `VideoWithTags` rows and **does not automatically delete** any item. Pair evidence consists of:
- duration difference: 0s (+2), at most 1s (+1), or at most 2s (reason only);
- capture time difference: 0s (+3), at most 5s (+2), or at most 60s (+1);
- normalized filename equal (+3) or very strict partial prefix (+1);
- same non-null resort (+1).

A pair is accepted when:
1. equal normalized meaningful filename and duration difference <=2 seconds, **or**
2. capture timestamps within 5 seconds and duration within 1 second, **or**
3. total evidence score >=5.

Filename normalization applies NFKC, lowercasing, extension and trailing-copy marker removal, retains Unicode letters/numbers, and discards generic names such as `video`, `movie` and `fullsizerender`. Candidate search compares pairs within a moving **60-second** capture-time window and adds equal-filename bucket comparisons across larger time gaps; duplicate pair evaluation is deduplicated.

Matching edges form an **undirected graph**. Connected components of 2+ videos become candidate groups, ordered by maximum score, group size and newest captured date. Confidence is `high` if the maximum pair score >=7, otherwise `medium`. Display reasons are shared evidence intersections (up to four); when none are shared, reason is `mixed`. Transitive grouping does **not** mean every pair in the group itself satisfies matching rules.

The duplicate-candidates Settings screen displays groups for user selection and confirmed deletion via the same safe deletion service. It is a similarity aid; it must not silently merge entries or erase their tags/diary associations.

## Key test anchors

- `scripts/tests/dateUtils.test.cjs`, `dashboardStats.test.cjs`: season boundaries, derived metrics.
- `scripts/tests/calendarUtils.test.cjs`: date/week math.
- `scripts/tests/videoSearch.test.cjs`, `searchRouteParams` utility: filter contract.
- `scripts/tests/duplicateDetectionService.test.cjs`: scores, normalization and graph groups.
- `src/hooks/useCalendarEnhanced.ts`, `src/hooks/useDashboard.ts`, `src/components/DiaryEditModal.tsx`: UI wiring.

**Cross references:** [03-persistence-and-migrations.md](03-persistence-and-migrations.md), [05-library-playback-and-deletion.md](05-library-playback-and-deletion.md).
