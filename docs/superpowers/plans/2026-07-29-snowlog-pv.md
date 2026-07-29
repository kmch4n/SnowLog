# SnowLog PV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Also load** `~/.claude/skills/remotion-best-practices/SKILL.md` and the rule files it points at before writing any Remotion code.

**Goal:** 設計書 `docs/superpowers/specs/2026-07-29-snowlog-pv-design.md` に基づき、SnowLog の 78 秒紹介映像を Remotion プロジェクト `pr/pv/` として実装し、1920×1080 / 60fps の MP4 を書き出せる状態にする。

**Architecture:** `pr/pv/` は `pr/web/` と並ぶ独立した npm プロジェクト。台本・尺・テロップは `src/script.ts` に集約し、`calculateMetadata` がナレーション音声の実尺を読んで各シーンのフレーム数を決める。シーンは 9 個の純粋コンポーネントで、`<Series>` に順に並べる。素材は `.temp/` から `public/` へコピーし、S2 用の静止フレームだけ ffmpeg で抽出する。

**Tech Stack:** Remotion 4.x / React 19 / TypeScript strict / `@remotion/media` / `@remotion/google-fonts` / `mediabunny` / Node 25 の組み込みテストランナー / ffmpeg 8.0

## Global Constraints

- Composition: `1920×1080`, `fps: 60`, 初期 `durationInFrames: 4680`（78 秒）
- TypeScript strict。インデントは **4 スペース**、文字列は **ダブルクォート**（リポジトリ規約）
- コード・コメント・コミットメッセージは **英語**。PV 内に表示される文言のみ日本語
- コミット形式: `[gitmoji] English message`（72 文字以内、現在形）。AI への言及禁止
- パレット: `alpineBlueDark #0A1929` / `alpineBlue #1565C0` / `glacierWhite #EBF1F7` / `morningGold #D4A843` / `textSecondary #4A6178`
- フォント: `Inter` + `Noto Sans JP`（LP `pr/web/src/styles/global.css` と統一）
- 素材は全て 30fps。**スピードランプ（0.3 倍スロー）は禁止**。S1 は 0.85 倍まで
- 画面収録は 592×1280。**部分ズーム禁止**（拡大すると破綻する）
- `pr/pv/public/` は git 追跡しない。`public/README.md` のみ追跡する
- ナレーション音声と BGM は未入手。**音声ファイルが無くても全編がレンダリングできること**が本計画の完了条件

---

### Task 1: Scaffold the `pr/pv` Remotion project

**Files:**
- Create: `pr/pv/package.json`, `pr/pv/tsconfig.json`, `pr/pv/remotion.config.ts`, `pr/pv/.gitignore`
- Create: `pr/pv/src/Root.tsx`, `pr/pv/src/index.ts`

**Interfaces:**
- Consumes: なし
- Produces: `npx remotion studio` が起動する空プロジェクト。以降の全タスクの土台

- [ ] **Step 1: Create the project directory and package.json**

```bash
mkdir -p "pr/pv/src"
```

`pr/pv/package.json`:

```json
{
    "name": "snowlog-pv",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "scripts": {
        "studio": "remotion studio",
        "render": "remotion render SnowLogPv out/snowlog-pv.mp4",
        "test": "node --test \"src/**/*.test.ts\""
    },
    "dependencies": {
        "@remotion/cli": "^4.0.0",
        "@remotion/google-fonts": "^4.0.0",
        "@remotion/media": "^4.0.0",
        "mediabunny": "^1.0.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "remotion": "^4.0.0"
    },
    "devDependencies": {
        "@types/react": "^19.0.0",
        "typescript": "^5.7.0"
    }
}
```

- [ ] **Step 2: Create tsconfig.json**

`allowImportingTsExtensions` は必須。Node の型ストリッピングで直接テストを走らせるため、
`src` 内の相対 import は全て `.ts` / `.tsx` 拡張子付きで書く。

`pr/pv/tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022", "DOM"],
        "module": "preserve",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "noEmit": true,
        "allowImportingTsExtensions": true,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src"]
}
```

- [ ] **Step 3: Create remotion.config.ts and .gitignore**

`pr/pv/remotion.config.ts`:

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setConcurrency(4);
```

`pr/pv/.gitignore`:

```
node_modules/
out/
public/*
!public/README.md
```

- [ ] **Step 4: Create a placeholder Root so the studio can start**

`pr/pv/src/index.ts`:

```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root.tsx";

registerRoot(RemotionRoot);
```

`pr/pv/src/Root.tsx`:

```tsx
import { AbsoluteFill, Composition } from "remotion";

const Placeholder: React.FC = () => {
    return <AbsoluteFill style={{ backgroundColor: "#0A1929" }} />;
};

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="SnowLogPv"
            component={Placeholder}
            durationInFrames={4680}
            fps={60}
            width={1920}
            height={1080}
        />
    );
};
```

- [ ] **Step 5: Install dependencies and verify the studio starts**

```bash
cd pr/pv && npm install
```

Run: `cd pr/pv && npx remotion render SnowLogPv out/smoke.mp4 --frames=0-11`
Expected: 成功し `pr/pv/out/smoke.mp4` が生成される。失敗したら依存の解決を先に直す。

- [ ] **Step 6: Commit**

```bash
git add pr/pv/package.json pr/pv/package-lock.json pr/pv/tsconfig.json pr/pv/remotion.config.ts pr/pv/.gitignore pr/pv/src
git commit -m "[🎉] Scaffold the Remotion project for the SnowLog PV"
```

---

### Task 2: Prepare the media assets

**Files:**
- Create: `pr/pv/scripts/prepare-assets.sh`
- Create: `pr/pv/public/README.md`
- Produces (untracked): `pr/pv/public/footage/`, `public/screen/`, `public/grid/`, `public/brand/`, `public/audio/`

**Interfaces:**
- Consumes: `.temp/*.MP4`（gitignore 済みの原素材 8 本）
- Produces: 以下の固定パス。以降のシーンは全てこの名前で `staticFile()` 参照する

| パス | 由来 |
| --- | --- |
| `footage/run.mp4` | 滑走動画.MP4 |
| `screen/import-01.mp4` | ホーム→インポート→まとめてインポート.MP4 |
| `screen/import-02.mp4` | ビデオを選択→読み込みへ.MP4 |
| `screen/import-03.mp4` | 読み込み→スキー場サジェスト.MP4 |
| `screen/detail.mp4` | 動画詳細→タイトル、スキー場など入力.MP4 |
| `screen/calendar.mp4` | カレンダー→日付詳細→日記を選択する.MP4 |
| `screen/diary.mp4` | 日記を入力.MP4 |
| `screen/dashboard.mp4` | ホーム→ダッシュボードをスクロール.MP4 |
| `grid/frame-01.jpg` … `frame-15.jpg` | 滑走動画から抽出 |
| `brand/icon.png` | `assets/images/icon.png` |
| `brand/app-store-badge.svg` | `pr/web/public/images/app-store-badge.svg` |

- [ ] **Step 1: Write the asset preparation script**

`pr/pv/scripts/prepare-assets.sh`（リポジトリルートから実行する）:

```bash
#!/usr/bin/env bash
# Copies raw footage from .temp/ into pr/pv/public/ under stable names
# and extracts still frames for the S2 grid. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/.temp"
DEST="$ROOT/pr/pv/public"

mkdir -p "$DEST/footage" "$DEST/screen" "$DEST/grid" "$DEST/brand" \
         "$DEST/audio/narration"

cp "$SRC/滑走動画.MP4"                                   "$DEST/footage/run.mp4"
cp "$SRC/ホーム→インポート→まとめてインポート.MP4"        "$DEST/screen/import-01.mp4"
cp "$SRC/ビデオを選択→読み込みへ.MP4"                     "$DEST/screen/import-02.mp4"
cp "$SRC/読み込み→スキー場サジェスト.MP4"                 "$DEST/screen/import-03.mp4"
cp "$SRC/動画詳細→動画選択してタイトル、スキー場など入力.MP4" "$DEST/screen/detail.mp4"
cp "$SRC/カレンダー→日付詳細→日記を選択する.MP4"           "$DEST/screen/calendar.mp4"
cp "$SRC/日記を入力.MP4"                                 "$DEST/screen/diary.mp4"
cp "$SRC/ホーム→ダッシュボードに飛ぶ ダッシュボードをスクロール.MP4" "$DEST/screen/dashboard.mp4"

cp "$ROOT/assets/images/icon.png"                        "$DEST/brand/icon.png"
cp "$ROOT/pr/web/public/images/app-store-badge.svg"      "$DEST/brand/app-store-badge.svg"

# 15 stills evenly spaced across the 7.7s run footage, for the S2 grid.
ffmpeg -y -loglevel error -i "$DEST/footage/run.mp4" \
    -vf "fps=2,scale=540:-1" -frames:v 15 -q:v 3 \
    "$DEST/grid/frame-%02d.jpg"

echo "Assets prepared in $DEST"
```

- [ ] **Step 2: Run the script and verify every expected file exists**

```bash
bash pr/pv/scripts/prepare-assets.sh
ls pr/pv/public/screen pr/pv/public/footage pr/pv/public/brand
ls pr/pv/public/grid | wc -l
```

Expected: `screen/` に 6 本、`footage/` に 1 本、`brand/` に 2 個、`grid/` に 15 枚。
`grid/` が 15 未満なら `fps=2` を上げて再実行する。

- [ ] **Step 3: Review the extracted grid frames for privacy**

抽出された 15 枚を目視し、**人物の顔・私的な情報が写り込んでいるコマを削除する**。
設計書 §10 の未解決事項 4 に対応する。削除して 15 枚を割り込んだ場合は残り枚数を
Task 8 の `GRID_FRAME_COUNT` に反映する。

- [ ] **Step 4: Write the public manifest**

`pr/pv/public/README.md`:

```markdown
# pr/pv/public

このディレクトリの中身は git 追跡対象外です（この README を除く）。
`bash pr/pv/scripts/prepare-assets.sh` をリポジトリルートで実行すると再生成されます。

原素材は `.temp/`（同じく追跡対象外）に置いてください。

## 手動で用意するもの

スクリプトでは生成できません。無い場合、映像は無音でレンダリングされます。

- `audio/narration/s01.wav` … `s09.wav` — シーン単位のナレーション音声
- `audio/bgm.mp3` — BGM

いずれも商用利用可のものを使い、クレジット条件を確認すること。
```

- [ ] **Step 5: Commit**

```bash
git add pr/pv/scripts/prepare-assets.sh pr/pv/public/README.md
git commit -m "[🔨] Add the asset preparation script for the PV"
```

---

### Task 3: Theme and fonts

**Files:**
- Create: `pr/pv/src/theme/colors.ts`, `pr/pv/src/theme/springs.ts`, `pr/pv/src/theme/typography.ts`

**Interfaces:**
- Consumes: なし
- Produces: `Palette`, `SPRING_SMOOTH`, `SPRING_SNAPPY`, `SPRING_BOUNCY`, `fontFamily`, `TYPE`

- [ ] **Step 1: Create the palette**

`pr/pv/src/theme/colors.ts`:

```ts
/**
 * Mirrors src/constants/colors.ts of the SnowLog app.
 * Copied rather than imported: crossing project boundaries would complicate
 * the tsconfig for values that almost never change. Keep in sync by hand.
 */
export const Palette = {
    backdrop: "#0A1929",
    primary: "#1565C0",
    primaryLight: "#DCEAF8",
    snow: "#EBF1F7",
    gold: "#D4A843",
    textSecondary: "#4A6178",
    white: "#FFFFFF",
} as const;
```

- [ ] **Step 2: Create the spring presets**

`pr/pv/src/theme/springs.ts`:

```ts
/** Smooth reveal without bounce. */
export const SPRING_SMOOTH = { damping: 200 } as const;

/** Snappy UI motion with minimal bounce. */
export const SPRING_SNAPPY = { damping: 20, stiffness: 200 } as const;

/** Playful entrance with visible bounce. */
export const SPRING_BOUNCY = { damping: 8 } as const;
```

- [ ] **Step 3: Create the typography module**

`pr/pv/src/theme/typography.ts`:

```tsx
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNotoSansJp } from "@remotion/google-fonts/NotoSansJP";

const inter = loadInter("normal", { weights: ["400", "700"], subsets: ["latin"] });
const notoSansJp = loadNotoSansJp("normal", { weights: ["400", "700"] });

/** Latin first, Japanese fallback — matches pr/web/src/styles/global.css. */
export const fontFamily = `${inter.fontFamily}, ${notoSansJp.fontFamily}, sans-serif`;

export const TYPE = {
    hero: { fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em" },
    caption: { fontSize: 56, fontWeight: 700, letterSpacing: "0.01em" },
    label: { fontSize: 32, fontWeight: 400, letterSpacing: "0.08em" },
    stat: { fontSize: 140, fontWeight: 700, letterSpacing: "-0.03em" },
} as const;
```

- [ ] **Step 4: Verify the fonts resolve**

Run: `cd pr/pv && npx tsc --noEmit`
Expected: エラーなし。`@remotion/google-fonts/NotoSansJP` が解決できない場合は
`npx remotion add @remotion/google-fonts` を実行してから再確認する。

- [ ] **Step 5: Commit**

```bash
git add pr/pv/src/theme
git commit -m "[💄] Add the PV theme, spring presets, and type scale"
```

---

### Task 4: The script as the single source of truth

**Files:**
- Create: `pr/pv/src/script.ts`
- Test: `pr/pv/src/script.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `SceneId`, `SceneSpec`, `SCENES`, `TOTAL_MIN_SECONDS`

- [ ] **Step 1: Write the failing test**

`pr/pv/src/script.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENES, TOTAL_MIN_SECONDS } from "./script.ts";

test("covers all nine scenes in order", () => {
    assert.equal(SCENES.length, 9);
    assert.deepEqual(
        SCENES.map((scene) => scene.id),
        ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09"],
    );
});

test("minimum durations add up to the designed 78 seconds", () => {
    assert.equal(TOTAL_MIN_SECONDS, 78);
});

test("every scene points at its own narration file", () => {
    for (const scene of SCENES) {
        assert.equal(scene.narrationFile, `audio/narration/${scene.id}.wav`);
    }
});

test("narration text stays within the spoken budget", () => {
    // 5.5 characters per second is the assumed Japanese reading speed.
    for (const scene of SCENES) {
        const spokenSeconds = scene.narrationText.length / 5.5;
        assert.ok(
            spokenSeconds <= scene.minDurationInSeconds,
            `${scene.id}: ${spokenSeconds.toFixed(1)}s of speech does not fit in ${scene.minDurationInSeconds}s`,
        );
    }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pr/pv && node --test "src/script.test.ts"`
Expected: FAIL — `Cannot find module './script.ts'`

- [ ] **Step 3: Write the script module**

`pr/pv/src/script.ts`:

```ts
export type SceneId =
    | "s01" | "s02" | "s03" | "s04" | "s05" | "s06" | "s07" | "s08" | "s09";

export type SceneSpec = {
    /** Stable identifier, also used for the narration filename. */
    id: SceneId;
    /** Human label shown in the Remotion studio sidebar. */
    title: string;
    /** Path passed to staticFile(). May not exist yet. */
    narrationFile: string;
    /** Spoken line. Kept here so the wording and the timing live together. */
    narrationText: string;
    /** On-screen captions, rendered in order. */
    captions: readonly string[];
    /** Floor for the scene length, used when narration audio is absent. */
    minDurationInSeconds: number;
    /** Silence held after the narration ends, so the motion can breathe. */
    tailInSeconds: number;
};

export const SCENES: readonly SceneSpec[] = [
    {
        id: "s01",
        title: "S1 Hook",
        narrationFile: "audio/narration/s01.wav",
        narrationText: "今日も、いい一本が撮れた。",
        captions: [],
        minDurationInSeconds: 7,
        tailInSeconds: 1.5,
    },
    {
        id: "s02",
        title: "S2 Grid",
        narrationFile: "audio/narration/s02.wav",
        narrationText: "でも、あの日の一本はどこにある。",
        captions: ["撮った動画は、増えていく。"],
        minDurationInSeconds: 7,
        tailInSeconds: 1.5,
    },
    {
        id: "s03",
        title: "S3 Logo",
        narrationFile: "audio/narration/s03.wav",
        narrationText: "SnowLog。滑走動画を、練習ログへ。",
        captions: ["滑走動画を、練習ログへ。"],
        minDurationInSeconds: 6,
        tailInSeconds: 1.5,
    },
    {
        id: "s04",
        title: "S4 Import",
        narrationFile: "audio/narration/s04.wav",
        narrationText:
            "まとめて取り込むだけ。GPSから、滑ったゲレンデを自動で推定します。収録は全国378ヶ所。",
        captions: ["まとめて取り込む", "378のゲレンデを収録"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
    },
    {
        id: "s05",
        title: "S5 Record",
        narrationFile: "audio/narration/s05.wav",
        narrationText: "大回り、小回り、コブ。動画に、その日の練習内容を紐づけて残せます。",
        captions: ["技術・タグ・メモ"],
        minDurationInSeconds: 12,
        tailInSeconds: 1,
    },
    {
        id: "s06",
        title: "S6 Calendar",
        narrationFile: "audio/narration/s06.wav",
        narrationText:
            "滑った日をカレンダーでたどれば、天候も、雪質も、あのときの手応えも、そのまま戻ってきます。",
        captions: ["カレンダーと日記"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
    },
    {
        id: "s07",
        title: "S7 Dashboard",
        narrationFile: "audio/narration/s07.wav",
        narrationText: "一本ずつの記録は、やがてシーズンの手応えになる。",
        captions: ["滑走日数 / ゲレンデ / テクニック"],
        minDurationInSeconds: 11,
        tailInSeconds: 1.5,
    },
    {
        id: "s08",
        title: "S8 Privacy",
        narrationFile: "audio/narration/s08.wav",
        narrationText: "データは端末の中だけ。広告も、課金もありません。",
        captions: ["オフラインファースト"],
        minDurationInSeconds: 7,
        tailInSeconds: 1,
    },
    {
        id: "s09",
        title: "S9 CTA",
        narrationFile: "audio/narration/s09.wav",
        narrationText: "SnowLog、App Store で無料配布中。",
        captions: ["iOS 16+ / 無料"],
        minDurationInSeconds: 6,
        tailInSeconds: 1.5,
    },
] as const;

export const TOTAL_MIN_SECONDS = SCENES.reduce(
    (total, scene) => total + scene.minDurationInSeconds,
    0,
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd pr/pv && node --test "src/script.test.ts"`
Expected: PASS（4 tests）

- [ ] **Step 5: Break it once to prove the test bites**

`s06` の `minDurationInSeconds` を一時的に `5` にして再実行する。
Expected: FAIL — "s06: 8.0s of speech does not fit in 5s"。確認したら元に戻す。

- [ ] **Step 6: Commit**

```bash
git add pr/pv/src/script.ts pr/pv/src/script.test.ts
git commit -m "[✨] Add the PV script as the single source of scene timing"
```

---

### Task 5: Resolve scene durations from narration audio

**Files:**
- Create: `pr/pv/src/timeline.ts`
- Test: `pr/pv/src/timeline.test.ts`

**Interfaces:**
- Consumes: `SceneSpec`, `SCENES` from `./script.ts`
- Produces:
  - `type ResolvedScene = SceneSpec & { durationInFrames: number; from: number }`
  - `resolveScenes(scenes: readonly SceneSpec[], narrationSeconds: ReadonlyMap<SceneId, number>, fps: number): ResolvedScene[]`
  - `totalFrames(resolved: readonly ResolvedScene[]): number`
  - `measureNarration(scenes: readonly SceneSpec[]): Promise<Map<SceneId, number>>`

- [ ] **Step 1: Write the failing test**

`pr/pv/src/timeline.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENES } from "./script.ts";
import { resolveScenes, totalFrames } from "./timeline.ts";

test("falls back to the minimum duration when narration is missing", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    assert.equal(resolved[0].durationInFrames, 7 * 60);
    assert.equal(totalFrames(resolved), 78 * 60);
});

test("stretches a scene when narration plus tail exceeds the minimum", () => {
    // s01 has a 7s minimum and a 1.5s tail. 8s of speech needs 9.5s.
    const resolved = resolveScenes(SCENES, new Map([["s01", 8]]), 60);

    assert.equal(resolved[0].durationInFrames, Math.ceil(9.5 * 60));
});

test("keeps the minimum when narration plus tail is shorter", () => {
    const resolved = resolveScenes(SCENES, new Map([["s01", 2]]), 60);

    assert.equal(resolved[0].durationInFrames, 7 * 60);
});

test("lays scenes out back to back", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    assert.equal(resolved[0].from, 0);
    assert.equal(resolved[1].from, 7 * 60);
    assert.equal(resolved[2].from, 14 * 60);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pr/pv && node --test "src/timeline.test.ts"`
Expected: FAIL — `Cannot find module './timeline.ts'`

- [ ] **Step 3: Write the timeline module**

`pr/pv/src/timeline.ts`:

```ts
import { Input, ALL_FORMATS, UrlSource } from "mediabunny";
import { staticFile } from "remotion";
import type { SceneId, SceneSpec } from "./script.ts";

export type ResolvedScene = SceneSpec & {
    durationInFrames: number;
    /** Absolute start frame within the composition. */
    from: number;
};

/**
 * Turns narration lengths into scene lengths.
 *
 * A scene lasts for whichever is longer: its designed minimum, or the
 * narration plus its tail. Scenes without narration keep their minimum, which
 * is what lets the whole film render before any audio has been recorded.
 */
export const resolveScenes = (
    scenes: readonly SceneSpec[],
    narrationSeconds: ReadonlyMap<SceneId, number>,
    fps: number,
): ResolvedScene[] => {
    let cursor = 0;

    return scenes.map((scene) => {
        const narration = narrationSeconds.get(scene.id);
        const spokenSeconds =
            narration === undefined ? 0 : narration + scene.tailInSeconds;
        const seconds = Math.max(scene.minDurationInSeconds, spokenSeconds);
        const durationInFrames = Math.ceil(seconds * fps);
        const resolved = { ...scene, durationInFrames, from: cursor };

        cursor += durationInFrames;
        return resolved;
    });
};

export const totalFrames = (resolved: readonly ResolvedScene[]): number =>
    resolved.reduce((total, scene) => total + scene.durationInFrames, 0);

/**
 * Reads the real length of each narration file. Missing files are skipped so
 * that an incomplete voice-over set never blocks a render.
 */
export const measureNarration = async (
    scenes: readonly SceneSpec[],
): Promise<Map<SceneId, number>> => {
    const entries = await Promise.all(
        scenes.map(async (scene): Promise<[SceneId, number] | null> => {
            try {
                const input = new Input({
                    formats: ALL_FORMATS,
                    source: new UrlSource(staticFile(scene.narrationFile), {
                        getRetryDelay: () => null,
                    }),
                });
                return [scene.id, await input.computeDuration()];
            } catch {
                return null;
            }
        }),
    );

    return new Map(entries.filter((entry) => entry !== null));
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd pr/pv && node --test "src/timeline.test.ts"`
Expected: PASS（4 tests）

- [ ] **Step 5: Break it once to prove the test bites**

`resolveScenes` の `Math.max` を `Math.min` に変えて再実行する。
Expected: FAIL — 「stretches a scene」が 570 ではなく 420 を返す。確認したら元に戻す。

- [ ] **Step 6: Commit**

```bash
git add pr/pv/src/timeline.ts pr/pv/src/timeline.test.ts
git commit -m "[✨] Derive PV scene lengths from the narration audio"
```

---

### Task 6: Caption and CountUp components

**Files:**
- Create: `pr/pv/src/components/Caption.tsx`, `pr/pv/src/components/CountUp.tsx`

**Interfaces:**
- Consumes: `Palette`, `SPRING_SNAPPY`, `fontFamily`, `TYPE`
- Produces:
  - `<Caption text={string} delayInFrames?={number} align?={"left" | "center"} />`
  - `<CountUp to={number} delayInFrames?={number} suffix?={string} />`

- [ ] **Step 1: Write the Caption component**

文字単位のスタッガー出現。1 文字あたり 2 フレームずらす。

`pr/pv/src/components/Caption.tsx`:

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";
import { SPRING_SNAPPY } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

const FRAMES_PER_CHARACTER = 2;

export const Caption: React.FC<{
    text: string;
    delayInFrames?: number;
    align?: "left" | "center";
}> = ({ text, delayInFrames = 0, align = "left" }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <div
            style={{
                display: "flex",
                justifyContent: align === "center" ? "center" : "flex-start",
                fontFamily,
                color: Palette.snow,
                ...TYPE.caption,
            }}
        >
            {Array.from(text).map((character, index) => {
                const progress = spring({
                    frame: frame - delayInFrames - index * FRAMES_PER_CHARACTER,
                    fps,
                    config: SPRING_SNAPPY,
                });

                return (
                    <span
                        key={`${character}-${index}`}
                        style={{
                            display: "inline-block",
                            opacity: progress,
                            transform: `translateY(${(1 - progress) * 28}px)`,
                            whiteSpace: "pre",
                        }}
                    >
                        {character}
                    </span>
                );
            })}
        </div>
    );
};
```

- [ ] **Step 2: Write the CountUp component**

`pr/pv/src/components/CountUp.tsx`:

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

export const CountUp: React.FC<{
    to: number;
    delayInFrames?: number;
    suffix?: string;
}> = ({ to, delayInFrames = 0, suffix = "" }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = spring({
        frame: frame - delayInFrames,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * 1.2),
    });

    return (
        <span
            style={{
                fontFamily,
                color: Palette.gold,
                fontVariantNumeric: "tabular-nums",
                ...TYPE.stat,
            }}
        >
            {Math.round(progress * to)}
            <span style={{ ...TYPE.label, color: Palette.textSecondary }}>{suffix}</span>
        </span>
    );
};
```

- [ ] **Step 3: Type-check**

Run: `cd pr/pv && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add pr/pv/src/components/Caption.tsx pr/pv/src/components/CountUp.tsx
git commit -m "[✨] Add caption stagger and count-up components for the PV"
```

---

### Task 7: DeviceFrame, FlashCut, and SnowParticles

**Files:**
- Create: `pr/pv/src/components/DeviceFrame.tsx`, `pr/pv/src/components/FlashCut.tsx`, `pr/pv/src/components/SnowParticles.tsx`

**Interfaces:**
- Consumes: `Palette`, `SPRING_SMOOTH`
- Produces:
  - `<DeviceFrame src={string} trimBefore?={number} trimAfter?={number} tiltDegrees?={number} />` — 画面収録を iPhone 枠に収めて 3D で傾ける
  - `<FlashCut durationInFrames?={number} />` — 冒頭の白フラッシュ
  - `<SnowParticles count?={number} />` — 降雪パーティクル

- [ ] **Step 1: Write DeviceFrame**

画面収録は 592×1280。等倍以下に収めるため高さ 960px（0.75 倍）で表示する。
**拡大しないこと**が制約なので `SCREEN_HEIGHT` は 1280 を超えてはならない。

`pr/pv/src/components/DeviceFrame.tsx`:

```tsx
import { Video } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";

const SCREEN_HEIGHT = 960;
const SCREEN_WIDTH = Math.round((SCREEN_HEIGHT * 592) / 1280);
const BEZEL = 14;

export const DeviceFrame: React.FC<{
    src: string;
    trimBefore?: number;
    trimAfter?: number;
    tiltDegrees?: number;
}> = ({ src, trimBefore, trimAfter, tiltDegrees = 8 }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Slow drift so the frame never sits perfectly still.
    const rotateY = interpolate(
        frame,
        [0, durationInFrames],
        [tiltDegrees, -tiltDegrees],
    );

    return (
        <div style={{ perspective: 2000, display: "grid", placeItems: "center", height: "100%" }}>
            <div
                style={{
                    transform: `rotateY(${rotateY}deg)`,
                    transformStyle: "preserve-3d",
                    padding: BEZEL,
                    borderRadius: 52,
                    backgroundColor: "#05121F",
                    boxShadow: `0 60px 120px rgba(0,0,0,0.55), 0 0 0 1px ${Palette.primary}40`,
                }}
            >
                <Video
                    src={staticFile(src)}
                    trimBefore={trimBefore}
                    trimAfter={trimAfter}
                    muted
                    style={{
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                        borderRadius: 40,
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            </div>
        </div>
    );
};
```

- [ ] **Step 2: Write FlashCut**

`pr/pv/src/components/FlashCut.tsx`:

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const FlashCut: React.FC<{ durationInFrames?: number }> = ({
    durationInFrames = 8,
}) => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame, [0, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity, pointerEvents: "none" }} />
    );
};
```

- [ ] **Step 3: Write SnowParticles**

`pr/pv/src/components/SnowParticles.tsx`:

```tsx
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

export const SnowParticles: React.FC<{ count?: number }> = ({ count = 90 }) => {
    const frame = useCurrentFrame();
    const { width, height, fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
            {new Array(count).fill(true).map((_, index) => {
                const seed = `snow-${index}`;
                const size = 2 + random(`${seed}-size`) * 5;
                const speed = 40 + random(`${seed}-speed`) * 90;
                const drift = (random(`${seed}-drift`) - 0.5) * 120;
                const seconds = frame / fps;
                const startY = random(`${seed}-y`) * height;

                return (
                    <div
                        key={seed}
                        style={{
                            position: "absolute",
                            left: random(`${seed}-x`) * width + Math.sin(seconds) * drift,
                            top: (startY + seconds * speed) % height,
                            width: size,
                            height: size,
                            borderRadius: "50%",
                            backgroundColor: "#FFFFFF",
                            opacity: 0.15 + random(`${seed}-opacity`) * 0.4,
                        }}
                    />
                );
            })}
        </AbsoluteFill>
    );
};
```

- [ ] **Step 4: Type-check**

Run: `cd pr/pv && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add pr/pv/src/components/DeviceFrame.tsx pr/pv/src/components/FlashCut.tsx pr/pv/src/components/SnowParticles.tsx
git commit -m "[✨] Add device frame, flash cut, and snow overlay for the PV"
```

---

### Task 8: Scenes S1–S3 (hook, grid, logo)

**Files:**
- Create: `pr/pv/src/scenes/S01Hook.tsx`, `S02Grid.tsx`, `S03Logo.tsx`

**Interfaces:**
- Consumes: `Caption`, `SnowParticles`, `Palette`, `fontFamily`, `TYPE`
- Produces: `<S01Hook />`, `<S02Grid />`, `<S03Logo />` — いずれも props なし

- [ ] **Step 1: Write S01Hook**

実写を全画面に敷き、グレインとビネットで 720p → 1080p 拡大の粗を隠す。
`playbackRate={0.85}` まで。スローにしすぎるとカクつく。

`pr/pv/src/scenes/S01Hook.tsx`:

```tsx
import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";

export const S01Hook: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const fadeOut = interpolate(
        frame,
        [durationInFrames - 20, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop, opacity: fadeOut }}>
            <Video
                src={staticFile("footage/run.mp4")}
                playbackRate={0.85}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Vignette and grain hide the 720p to 1080p upscale. */}
            <AbsoluteFill
                style={{
                    background:
                        "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(10,25,41,0.85) 100%)",
                }}
            />
            <AbsoluteFill
                style={{
                    opacity: 0.06,
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
                }}
            />
        </AbsoluteFill>
    );
};
```

- [ ] **Step 2: Write S02Grid**

`GRID_FRAME_COUNT` は Task 2 Step 3 で残した実枚数に合わせる。
3D パースをつけた列が上下に流れ、「増え続けて辿り着けない」感を出す。

`pr/pv/src/scenes/S02Grid.tsx`:

```tsx
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption.tsx";
import { Palette } from "../theme/colors.ts";

const GRID_FRAME_COUNT = 15;
const COLUMNS = 6;
const ROWS = 8;
const TILE_WIDTH = 300;
const TILE_HEIGHT = 190;
const GAP = 18;

const tileSrc = (index: number): string => {
    const frameNumber = (index % GRID_FRAME_COUNT) + 1;
    return staticFile(`grid/frame-${String(frameNumber).padStart(2, "0")}.jpg`);
};

export const S02Grid: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const scroll = interpolate(frame, [0, durationInFrames], [0, -900]);

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop, overflow: "hidden" }}>
            <AbsoluteFill style={{ perspective: 1400, display: "grid", placeItems: "center" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_WIDTH}px)`,
                        gap: GAP,
                        transform: `rotateX(38deg) rotateZ(-8deg) translateY(${scroll}px)`,
                        transformStyle: "preserve-3d",
                    }}
                >
                    {new Array(COLUMNS * ROWS).fill(true).map((_, index) => (
                        <Img
                            key={index}
                            src={tileSrc(index)}
                            style={{
                                width: TILE_WIDTH,
                                height: TILE_HEIGHT,
                                objectFit: "cover",
                                borderRadius: 10,
                                opacity: 0.55,
                            }}
                        />
                    ))}
                </div>
            </AbsoluteFill>

            {/* Darken the edges so the grid reads as endless. */}
            <AbsoluteFill
                style={{
                    background:
                        "linear-gradient(to bottom, rgba(10,25,41,0.95) 0%, rgba(10,25,41,0) 35%, rgba(10,25,41,0) 55%, rgba(10,25,41,0.98) 100%)",
                }}
            />
            <AbsoluteFill style={{ justifyContent: "flex-end", padding: 120 }}>
                <Caption text="撮った動画は、増えていく。" delayInFrames={30} />
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
```

- [ ] **Step 3: Write S03Logo**

`pr/pv/src/scenes/S03Logo.tsx`:

```tsx
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SnowParticles } from "../components/SnowParticles.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

export const S03Logo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const iconIn = spring({ frame, fps, config: SPRING_SMOOTH });
    // The tagline is revealed by a mask that wipes across it.
    const wipe = interpolate(frame, [18, 54], [0, 100], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: Palette.backdrop,
                display: "grid",
                placeItems: "center",
                gap: 48,
            }}
        >
            <SnowParticles count={70} />
            <Img
                src={staticFile("brand/icon.png")}
                style={{
                    width: 220,
                    height: 220,
                    borderRadius: 48,
                    opacity: iconIn,
                    transform: `scale(${0.85 + iconIn * 0.15})`,
                }}
            />
            <div
                style={{
                    fontFamily,
                    color: Palette.snow,
                    ...TYPE.hero,
                    WebkitMaskImage: `linear-gradient(to right, #000 ${wipe}%, transparent ${wipe}%)`,
                    maskImage: `linear-gradient(to right, #000 ${wipe}%, transparent ${wipe}%)`,
                }}
            >
                滑走動画を、練習ログへ。
            </div>
        </AbsoluteFill>
    );
};
```

- [ ] **Step 4: Verify each scene renders as a still**

先に Task 10 の Root を書く必要はない。以下で個別確認する。

Run: `cd pr/pv && npx tsc --noEmit`
Expected: エラーなし。視覚確認は Task 10 の Studio 起動時にまとめて行う。

- [ ] **Step 5: Commit**

```bash
git add pr/pv/src/scenes/S01Hook.tsx pr/pv/src/scenes/S02Grid.tsx pr/pv/src/scenes/S03Logo.tsx
git commit -m "[✨] Add the opening three scenes of the PV"
```

---

### Task 9: Scenes S4–S9 (screen recordings, dashboard, privacy, CTA)

**Files:**
- Create: `pr/pv/src/scenes/S04Import.tsx`, `S05Record.tsx`, `S06Calendar.tsx`, `S07Dashboard.tsx`, `S08Privacy.tsx`, `S09Cta.tsx`

**Interfaces:**
- Consumes: `DeviceFrame`, `Caption`, `CountUp`, `Palette`, `fontFamily`, `TYPE`
- Produces: `<S04Import />`, `<S05Record />`, `<S06Calendar />`, `<S07Dashboard />`, `<S08Privacy />`, `<S09Cta />` — いずれも props なし

- [ ] **Step 1: Write a shared screen-scene layout**

S4–S7 は「左にコピー、右にデバイス」の同一レイアウト。重複を避けて 1 つにまとめる。

`pr/pv/src/components/ScreenScene.tsx`:

```tsx
import { AbsoluteFill } from "remotion";
import { Caption } from "./Caption.tsx";
import { Palette } from "../theme/colors.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

export const ScreenScene: React.FC<{
    eyebrow: string;
    captions: readonly string[];
    children: React.ReactNode;
}> = ({ eyebrow, captions, children }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    alignItems: "center",
                    height: "100%",
                    padding: "0 120px",
                }}
            >
                <div style={{ display: "grid", gap: 28 }}>
                    <div style={{ fontFamily, color: Palette.gold, ...TYPE.label }}>
                        {eyebrow}
                    </div>
                    {captions.map((caption, index) => (
                        <Caption
                            key={caption}
                            text={caption}
                            delayInFrames={20 + index * 40}
                        />
                    ))}
                </div>
                <div style={{ height: "100%" }}>{children}</div>
            </div>
        </AbsoluteFill>
    );
};
```

- [ ] **Step 2: Write S04Import**

3 本の収録を順に繋ぐ。合計 11.7 秒あるが枠は 11 秒なので、最後の 1 本を短く切る。

`trimBefore` / `trimAfter` は **コンポジションのフレーム単位**であって、素材の 30fps ではない。
秒数 × 60 で指定する。ここを素材 fps で計算すると尺が半分になる。

`pr/pv/src/scenes/S04Import.tsx`:

```tsx
import { Series } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

/** Trim values are expressed in composition frames, not source frames. */
const FPS = 60;

export const S04Import: React.FC = () => {
    return (
        <ScreenScene eyebrow="IMPORT" captions={["まとめて取り込む", "378のゲレンデを収録"]}>
            <Series>
                <Series.Sequence durationInFrames={3.1 * 60} premountFor={60}>
                    <DeviceFrame src="screen/import-01.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={1.6 * 60} premountFor={60}>
                    <DeviceFrame src="screen/import-02.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={6.3 * 60} premountFor={60}>
                    <DeviceFrame
                        src="screen/import-03.mp4"
                        trimAfter={Math.round(6.3 * FPS)}
                    />
                </Series.Sequence>
            </Series>
        </ScreenScene>
    );
};
```

- [ ] **Step 3: Write S05Record**

素材は 16.3 秒、枠は 12 秒。頭の 2 秒を落として 12 秒使う。

`pr/pv/src/scenes/S05Record.tsx`:

```tsx
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

/** Trim values are expressed in composition frames, not source frames. */
const FPS = 60;

export const S05Record: React.FC = () => {
    return (
        <ScreenScene eyebrow="RECORD" captions={["技術・タグ・メモ"]}>
            <DeviceFrame
                src="screen/detail.mp4"
                trimBefore={2 * FPS}
                trimAfter={14 * FPS}
            />
        </ScreenScene>
    );
};
```

- [ ] **Step 4: Write S06Calendar**

カレンダー 4.9 秒 + 日記 9.1 秒 = 14 秒を 11 秒に収める。日記側を 6.1 秒に切る。

`pr/pv/src/scenes/S06Calendar.tsx`:

```tsx
import { Series } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

/** Trim values are expressed in composition frames, not source frames. */
const FPS = 60;

export const S06Calendar: React.FC = () => {
    return (
        <ScreenScene eyebrow="LOOK BACK" captions={["カレンダーと日記"]}>
            <Series>
                <Series.Sequence durationInFrames={4.9 * 60} premountFor={60}>
                    <DeviceFrame src="screen/calendar.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={6.1 * 60} premountFor={60}>
                    <DeviceFrame
                        src="screen/diary.mp4"
                        trimAfter={Math.round(6.1 * FPS)}
                    />
                </Series.Sequence>
            </Series>
        </ScreenScene>
    );
};
```

- [ ] **Step 5: Write S07Dashboard**

デバイスに加えて、手前に数字のカウントアップを重ねる。数値は実データではなく
「積み上がった様子」を示す代表値。`suffix` で単位を添える。

`pr/pv/src/scenes/S07Dashboard.tsx`:

```tsx
import { AbsoluteFill } from "remotion";
import { CountUp } from "../components/CountUp.tsx";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";
import { Palette } from "../theme/colors.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

const STATS = [
    { label: "滑走日数", to: 24, suffix: "日", delay: 20 },
    { label: "ゲレンデ", to: 9, suffix: "ヶ所", delay: 50 },
    { label: "動画", to: 312, suffix: "本", delay: 80 },
] as const;

export const S07Dashboard: React.FC = () => {
    return (
        <ScreenScene eyebrow="SEASON" captions={["滑走日数 / ゲレンデ / テクニック"]}>
            <AbsoluteFill>
                <DeviceFrame src="screen/dashboard.mp4" tiltDegrees={5} />
                <AbsoluteFill
                    style={{
                        justifyContent: "flex-end",
                        alignItems: "center",
                        paddingBottom: 60,
                        gap: 8,
                    }}
                >
                    <div style={{ display: "flex", gap: 56 }}>
                        {STATS.map((stat) => (
                            <div key={stat.label} style={{ textAlign: "center" }}>
                                <CountUp
                                    to={stat.to}
                                    suffix={stat.suffix}
                                    delayInFrames={stat.delay}
                                />
                                <div
                                    style={{
                                        fontFamily,
                                        color: Palette.textSecondary,
                                        ...TYPE.label,
                                    }}
                                >
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </AbsoluteFill>
            </AbsoluteFill>
        </ScreenScene>
    );
};
```

- [ ] **Step 6: Write S08Privacy**

素材なしの CG シーン。外周から情報がアイコンに吸い込まれる図。

`pr/pv/src/scenes/S08Privacy.tsx`:

```tsx
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";

const DOT_COUNT = 28;

export const S08Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const pull = spring({
        frame,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * 2.4),
    });

    return (
        <AbsoluteFill
            style={{ backgroundColor: Palette.backdrop, display: "grid", placeItems: "center" }}
        >
            {new Array(DOT_COUNT).fill(true).map((_, index) => {
                const angle = (index / DOT_COUNT) * Math.PI * 2;
                const startRadius = 420 + random(`dot-${index}`) * 260;
                const radius = interpolate(pull, [0, 1], [startRadius, 120]);

                return (
                    <div
                        key={index}
                        style={{
                            position: "absolute",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: Palette.primaryLight,
                            opacity: interpolate(pull, [0, 0.8, 1], [0.8, 0.8, 0]),
                            transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                        }}
                    />
                );
            })}
            <Img
                src={staticFile("brand/icon.png")}
                style={{ width: 200, height: 200, borderRadius: 44 }}
            />
            <AbsoluteFill style={{ justifyContent: "flex-end", padding: 120 }}>
                <Caption text="オフラインファースト" delayInFrames={40} align="center" />
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
```

- [ ] **Step 7: Write S09Cta**

`pr/pv/src/scenes/S09Cta.tsx`:

```tsx
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SnowParticles } from "../components/SnowParticles.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

export const S09Cta: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const badgeIn = spring({ frame: frame - 24, fps, config: SPRING_SMOOTH });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: Palette.backdrop,
                display: "grid",
                placeItems: "center",
                gap: 36,
            }}
        >
            <SnowParticles count={60} />
            <Img
                src={staticFile("brand/icon.png")}
                style={{ width: 180, height: 180, borderRadius: 40 }}
            />
            <div style={{ fontFamily, color: Palette.snow, ...TYPE.hero }}>SnowLog</div>
            <Img
                src={staticFile("brand/app-store-badge.svg")}
                style={{
                    width: 320,
                    opacity: badgeIn,
                    transform: `translateY(${(1 - badgeIn) * 24}px)`,
                }}
            />
            <div style={{ fontFamily, color: Palette.textSecondary, ...TYPE.label }}>
                iOS 16+ / 無料
            </div>
        </AbsoluteFill>
    );
};
```

- [ ] **Step 8: Type-check**

Run: `cd pr/pv && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 9: Commit**

```bash
git add pr/pv/src/components/ScreenScene.tsx pr/pv/src/scenes
git commit -m "[✨] Add the remaining six scenes of the PV"
```

---

### Task 10: Assemble the composition

**Files:**
- Modify: `pr/pv/src/Root.tsx`（Task 1 のプレースホルダを置き換える）
- Create: `pr/pv/src/SnowLogPv.tsx`

**Interfaces:**
- Consumes: `SCENES`, `resolveScenes`, `measureNarration`, `totalFrames`, 全 9 シーン, `FlashCut`
- Produces: Composition `SnowLogPv`。`calculateMetadata` が音声実尺から尺を決める

- [ ] **Step 1: Write the main composition**

シーン転換は `<TransitionSeries>` を使わない。尺が音声由来で決まるため、
トランジションによる短縮分の計算が絡むと合計フレーム数が読めなくなる。
代わりに各シーン冒頭に `<FlashCut />` を重ね、カット点の白フラッシュとして見せる。
これなら合計 = 各シーンの単純な和になる。

`pr/pv/src/SnowLogPv.tsx`:

```tsx
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { FlashCut } from "./components/FlashCut.tsx";
import { S01Hook } from "./scenes/S01Hook.tsx";
import { S02Grid } from "./scenes/S02Grid.tsx";
import { S03Logo } from "./scenes/S03Logo.tsx";
import { S04Import } from "./scenes/S04Import.tsx";
import { S05Record } from "./scenes/S05Record.tsx";
import { S06Calendar } from "./scenes/S06Calendar.tsx";
import { S07Dashboard } from "./scenes/S07Dashboard.tsx";
import { S08Privacy } from "./scenes/S08Privacy.tsx";
import { S09Cta } from "./scenes/S09Cta.tsx";
import { Palette } from "./theme/colors.ts";
import type { SceneId } from "./script.ts";
import type { ResolvedScene } from "./timeline.ts";

export type SnowLogPvProps = {
    scenes: ResolvedScene[];
    /** True when at least one narration file was found. */
    hasNarration: boolean;
    hasBgm: boolean;
};

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
    s01: S01Hook,
    s02: S02Grid,
    s03: S03Logo,
    s04: S04Import,
    s05: S05Record,
    s06: S06Calendar,
    s07: S07Dashboard,
    s08: S08Privacy,
    s09: S09Cta,
};

/** Duck the music under narration so the voice stays legible. */
const BGM_BASE_VOLUME = 0.35;
const BGM_DUCKED_VOLUME = 0.09;

export const SnowLogPv: React.FC<SnowLogPvProps> = ({ scenes, hasNarration, hasBgm }) => {
    const { fps, durationInFrames } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop }}>
            {scenes.map((scene) => {
                const Scene = SCENE_COMPONENTS[scene.id];

                return (
                    <Sequence
                        key={scene.id}
                        from={scene.from}
                        durationInFrames={scene.durationInFrames}
                        premountFor={fps}
                    >
                        <Scene />
                        <FlashCut />
                        {hasNarration ? <Audio src={staticFile(scene.narrationFile)} /> : null}
                    </Sequence>
                );
            })}

            {hasBgm ? (
                <Audio
                    src={staticFile("audio/bgm.mp3")}
                    loop
                    loopVolumeCurveBehavior="extend"
                    volume={(f) =>
                        interpolate(
                            f,
                            [0, fps, durationInFrames - fps * 2, durationInFrames],
                            [
                                0,
                                hasNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
                                hasNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
                                0,
                            ],
                            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                        )
                    }
                />
            ) : null}
        </AbsoluteFill>
    );
};
```

- [ ] **Step 2: Wire calculateMetadata into Root**

`pr/pv/src/Root.tsx`（全置き換え）:

```tsx
import { Composition, staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { SCENES } from "./script.ts";
import { SnowLogPv } from "./SnowLogPv.tsx";
import type { SnowLogPvProps } from "./SnowLogPv.tsx";
import { measureNarration, resolveScenes, totalFrames } from "./timeline.ts";

const FPS = 60;

const fileExists = async (path: string): Promise<boolean> => {
    try {
        const response = await fetch(staticFile(path), { method: "HEAD" });
        return response.ok;
    } catch {
        return false;
    }
};

const calculateMetadata: CalculateMetadataFunction<SnowLogPvProps> = async () => {
    const narrationSeconds = await measureNarration(SCENES);
    const scenes = resolveScenes(SCENES, narrationSeconds, FPS);

    return {
        durationInFrames: totalFrames(scenes),
        props: {
            scenes,
            hasNarration: narrationSeconds.size > 0,
            hasBgm: await fileExists("audio/bgm.mp3"),
        },
    };
};

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="SnowLogPv"
            component={SnowLogPv}
            durationInFrames={78 * FPS}
            fps={FPS}
            width={1920}
            height={1080}
            defaultProps={{ scenes: [], hasNarration: false, hasBgm: false }}
            calculateMetadata={calculateMetadata}
        />
    );
};
```

- [ ] **Step 3: Type-check and run the full test suite**

Run: `cd pr/pv && npx tsc --noEmit && npm test`
Expected: 型エラーなし、8 tests PASS

- [ ] **Step 4: Verify the composition length with no audio present**

Run: `cd pr/pv && npx remotion compositions`
Expected: `SnowLogPv` が `4680` フレーム（78 秒 × 60fps）と表示される。
音声ファイルが 1 つも無い状態で 4680 にならなければ `resolveScenes` の呼び出しを疑う。

- [ ] **Step 5: Render still frames from every scene and inspect them**

```bash
cd pr/pv
for f in 60 480 900 1500 2200 2900 3600 4100 4500; do
    npx remotion still SnowLogPv "out/still-$f.png" --frame=$f
done
```

Expected: 9 枚の PNG が生成される。各シーンが意図どおり構図に収まっているか目視する。
デバイス枠が見切れている、テロップが重なっている、グリッドが薄すぎる、といった
崩れがあればこの段階で直す。

- [ ] **Step 6: Commit**

```bash
git add pr/pv/src/Root.tsx pr/pv/src/SnowLogPv.tsx
git commit -m "[✨] Assemble the SnowLog PV composition"
```

---

### Task 11: Render and embed the PV on the landing page

**Files:**
- Create: `pr/web/public/videos/snowlog-pv-720p.mp4`, `pr/web/public/videos/snowlog-pv-poster.jpg`
- Modify: `pr/web/src/components/AppHero.astro`
- Modify: `pr/web/src/i18n.ts` and `pr/web/src/content.ts`（動画の見出しと代替テキスト）

**Interfaces:**
- Consumes: Task 10 の Composition
- Produces: LP 上で再生できる PV

- [ ] **Step 1: Render the master**

```bash
cd pr/pv && npx remotion render SnowLogPv out/snowlog-pv.mp4
```

Expected: 1920×1080 / 60fps の MP4。78 秒（音声を入れた後は伸びる）。
再生して全編を通しで確認する。

- [ ] **Step 2: Derive the 720p web copy and the poster**

```bash
cd pr/pv
ffmpeg -y -i out/snowlog-pv.mp4 -vf scale=1280:720 -c:v libx264 -crf 26 \
    -preset slow -movflags +faststart -c:a aac -b:a 128k \
    ../web/public/videos/snowlog-pv-720p.mp4
ffmpeg -y -i out/snowlog-pv.mp4 -ss 16 -frames:v 1 -vf scale=1280:720 -q:v 3 \
    ../web/public/videos/snowlog-pv-poster.jpg
ls -lh ../web/public/videos
```

Expected: MP4 が 10MB 未満。超える場合は `-crf` を 28 まで上げる。
ポスターは S3（ロゴ）の 16 秒地点から取る。

- [ ] **Step 3: Add the copy for the video block**

`pr/web/src/i18n.ts` の `HomeContent` 型に以下を追加する:

```ts
video: {
    eyebrow: string;
    title: string;
    ariaLabel: string;
};
```

`pr/web/src/content.ts` の `homeContent` に追加する（`hero` の直後）:

```ts
video: {
    eyebrow: "Movie",
    title: "1分半で分かる、SnowLog。",
    ariaLabel: "SnowLogの紹介映像",
},
```

- [ ] **Step 4: Embed the video under the hero**

`pr/web/src/components/AppHero.astro` の `</section>` の直前に追加する。
**自動再生しない。** ナレーション入りのため、ポスターからのクリック再生とする。

```astro
<section class="hero-video" aria-labelledby="hero-video-title">
    <p class="eyebrow">{content.video.eyebrow}</p>
    <h2 id="hero-video-title">{content.video.title}</h2>
    <video
        controls
        preload="none"
        playsinline
        poster="/videos/snowlog-pv-poster.jpg"
        aria-label={content.video.ariaLabel}
    >
        <source src="/videos/snowlog-pv-720p.mp4" type="video/mp4" />
    </video>
</section>
```

同ファイルの `<style>` 末尾に追加する:

```css
.hero-video {
    margin: 96px auto 0;
    max-width: 960px;
    text-align: center;
}

.hero-video video {
    width: 100%;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: block;
    margin-top: 24px;
}
```

- [ ] **Step 5: Verify the landing page**

```bash
cd pr/web && npm run build
```

Expected: ビルド成功。`npm run dev` で起動し、ポスターが表示され、
クリックで音声つきで再生されることをブラウザで確認する。
**自動再生されていないこと**も確認する。

- [ ] **Step 6: Commit**

```bash
git add pr/web/public/videos pr/web/src/components/AppHero.astro pr/web/src/i18n.ts pr/web/src/content.ts
git commit -m "[✨] Embed the SnowLog PV on the landing page"
```

---

## Deferred work

以下は本計画の範囲外。素材が揃った時点で着手する。

- **ナレーション音声の収録。** `public/audio/narration/s01.wav` … `s09.wav` を置くだけで
  `calculateMetadata` が尺を再計算する。シーンの作り直しは発生しない。
  置いたら Task 11 Step 1 以降をやり直す。
- **BGM の追加。** `public/audio/bgm.mp3` を置けばダッキング付きで鳴る。
- **S1 で使う滑走動画の区間調整。** 現状は素材の先頭から 0.85 倍で流している。
  別の箇所を使いたくなったら `S01Hook.tsx` の `<Video>` に `trimBefore` を足す
  （コンポジションフレーム = 秒 × 60）。設計書 §10 の未解決事項 3 に対応する。
- **YouTube へのアップロード。** マスター `pr/pv/out/snowlog-pv.mp4` をそのまま使う。
- 英語版、9:16 縦版、App Store の App Preview。設計書 §9 参照。
