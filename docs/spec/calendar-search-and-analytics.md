# Calendar, Diaries, Search, and Season Analytics

## Shared date semantics

The application stores video timestamps as **Unix seconds** and derives local calendar days through `toDateKey(timestamp)` (`YYYY-MM-DD` in the device's current local time zone). Do not use UTC `toISOString().slice(0, 10)` to determine diary membership: a boundary near local midnight can map to a different UTC date.

Date-filter endpoints use local `startOfMonth` and `endOfMonth`, expressed in Unix seconds. For a week, `getWeekDateRange` uses the local midnight of the first day and the final second of the last day. A change to any shared local-date rule affects Home, Search, Calendar, Dashboard and GPS same-day assignment.

## Calendar: month and week presentations

The `calendar` tab renders `CalendarMonthGrid` or `CalendarWeekStrip` and a selected-day details panel. `useCalendarEnhanced` owns year/month, selected day, `viewMode` (`month`/`week`), week offset, filters and aggregation. The screen supports navigation between months/weeks, tapping date cells and toggling presentation; its gesture path uses Reanimated/Gesture Handler and must not conflict with native scrolling.

The week starts on **Monday or Sunday**, controlled by the persisted `app_preferences.weekStartDay` key (default Monday). `calendarUtils.ts` owns weekday labels, month offset, week-date generation and week-number calculations. Week math works in local time, including week boundaries that span months.

Each calendar day aggregates matching videos into `DayInfo`:

| Field | Meaning |
| --- | --- |
| `dateKey` | Local `YYYY-MM-DD` key |
| `videoCount` | Number of videos captured that day |
| `resortNames` | Distinct resorts, truncated for colored markers |
| `thumbnailUri` | Representative video poster if present |
| `hasDiary` | Whether a diary record exists for that date |

The day cell can display a count/thumbnail, resort color indicators and a diary marker. Selecting a day lists that day's videos and its diary card; tapping a video opens detail. Video data comes through `useVideos` using month/week bounds. Diary-presence keys are separately fetched from `diaryEntryRepository.getDiaryDateKeysInRange`, and stale results are discarded if the user changes the active range.

## Diary lifecycle

`useDiaryEntry(dateKey)` reads one record, saves via `upsertDiaryEntry` and deletes by unique date key. When the selection changes, old asynchronous reads are prevented from overwriting the newly selected diary.

`DiaryEditModal` contains required date identity and the following optional record content:

| Field | Storage | Input semantics |
| --- | --- | --- |
| Resort | Nullable text | Chosen resort name |
| Weather | Nullable code | Values from `WEATHER_OPTIONS` |
| Snow conditions | Nullable text | Choice(s) represented by the modal and `SNOW_CONDITION_OPTIONS` |
| Impressions | Non-null text | Free-form narrative |
| Temperature | Nullable integer | Degrees Celsius |
| Companions | Nullable text | Free-form names/description |
| Fatigue level | Nullable integer | UI choice 1–5 |
| Expenses | Nullable integer | JPY |
| Number of runs | Nullable integer | Count |

The editor populates fields from an existing diary, exposes additional fields in an optional section, and supports automatic save on close **when content exists**. For an existing entry emptied of content, deletion follows a confirmation flow rather than silently overwriting. An explicit delete control also confirms removal. A diary persists independently of videos: deleting all videos for a date does not imply deleting that diary.

The DB uses `date_key` as a unique conflict target for a full-field upsert and tracks created/updated Unix-second timestamps.

## Search query contract

`src/app/(tabs)/search/index.tsx` holds a `FilterOptions` object and displays `FilterBar` over a `FlatList` of results. `useVideos` makes the underlying repository call and batches tag loading. Available conditions:

- Free text: `filename`, user `title` and `memo`; `containsText` escapes SQLite LIKE meta-characters to avoid interpreting user-entered `%` and `_` as patterns.
- Ski resort: exact `skiResortName` match.
- Tags: match videos associated with any selected tag IDs as implemented by `inArray` (not an implicit all-tags AND).
- Capture date: inclusive `dateFrom` / `dateTo` Unix-second bounds.
- Favorites-only: require `isFavorite = 1`.

These constraints are combined as SQL AND across filter categories. Results are ordered by capture time descending at repository level. `FilterBar` maintains a search draft and applies free text after a **400 ms debounce**; the date presets include this month, last month and current season, with explicit clear and multi-filter controls.

`buildSearchHref` / `buildSearchRouteParams` serialize filters into typed route parameters; `parseSearchRouteParams` validates numbers and booleans, splits tag IDs and returns null for an empty filter. The destination consumes those parameters to configure Search and clears them to avoid stale filter reapplication. A `requestKey` differentiates repeated identical drill-downs.

## Season definition

`SEASON_START_MONTH = 10` in `dateUtils.ts` defines each season as **October 1 through the following September 30**, inclusive in local time. `buildSeason(2025)` produces `2025-26`; `seasonStartYearOf` uses the current year from October onwards and the previous year before October. `seasonMonths` returns all **12** months, including empty months.

The older November–May season left June–October footage outside all seasons. Do **not** reintroduce that gap. The season definition is shared by dashboard and Search's “this season” date preset. If it changes, revise all clients and historical queries together.

`useDashboard` initializes to the current season and offers prior seasons back through the oldest captured video. Switching season fetches new stats; returning to the same season may keep the current display while refetching.

## Dashboard computation contract

`dashboardRepository.getDashboardStats` fetches the selected season's minimally required video columns and up to five recent full rows. `dashboardStats.buildDashboardStats` performs deterministic aggregation; `useDashboard` adds tags to recent items in a batched query.

| Aggregate | Calculation |
| --- | --- |
| Ski days (`totalSkiDays`) | Count distinct local `toDateKey(capturedAt)` values |
| Videos (`totalVideoCount`) | Count season rows |
| Duration (`totalDurationSeconds`) | Sum recorded `duration` seconds |
| Resorts (`uniqueResortCount`) | Count distinct nonempty `skiResortName` values |
| Favorites (`favoriteCount`) | Count rows with `isFavorite = 1` |
| Resort ranking | Group by resort; count distinct visit dates and videos; use most recent timestamp; order visit days desc, then videos desc |
| Technique distribution | Parse each video's JSON technique names; increment each selected name, order descending by count |
| Monthly trend | All 12 season months, including zeros; count videos and distinct day keys |
| Activity heatmap | Video count per local day, ascending by date key |
| Recent videos | Up to 5 latest captures, with full data normalized and tags added |

The dashboard renders Summary Cards, resort ranking bars, technique distribution bars, monthly bars with switchable video/day metric, an activity heatmap and recent video cards. Interactive chart elements can navigate to Search with appropriate resort, month or day filters; navigate via `buildSearchHref`, not by inventing a parallel filter format.

**Caveat:** Ski days are inferred from the **existence of video rows** on a day. A diary-only day is not automatically a ski day in the video-based dashboard aggregates. Technique counts can exceed the number of videos because multiple techniques may be assigned to one video.

## Error/consistency rules

- Returning focus refreshes source data; do not preserve stale results after changing search filters.
- Queries/aggregations must use the same local-day boundaries, or Calendar and Dashboard will disagree.
- Empty months must remain visible in the monthly trend; silently omitting zeros distorts seasonal comparisons.
- Invalid JSON technique data should be handled through `parseTechniques` rather than crashing analytics.
- A date correction (future Issue #93) must invalidate dependent Home, Calendar, Search and Dashboard views.

## Sources

`src/app/(tabs)/calendar/index.tsx`; `src/app/(tabs)/search/index.tsx`; `src/app/(tabs)/dashboard/index.tsx`; `src/components/{CalendarMonthGrid,CalendarWeekStrip,CalendarDayCell,DiaryEditModal,DiaryCard,FilterBar}.tsx`; `src/hooks/{useCalendarEnhanced,useDiaryEntry,useDashboard,useVideos}.ts`; `src/utils/{calendarUtils,dateUtils,dashboardStats,searchRouteParams}.ts`; `src/database/repositories/{diaryEntryRepository,dashboardRepository,videoRepository}.ts`.
