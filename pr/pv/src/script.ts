import type { TransitionKind } from "./components/transitions/SceneTransition.tsx";

export type SceneId =
    | "s00"
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
    /** Small label above the captions. Omitted by the full-bleed scenes. */
    eyebrow?: string;
    /** On-screen captions, rendered in order. Scenes read these; never inline a
     *  caption in a scene file, or the two copies will drift apart. */
    captions: readonly string[];
    /** Floor for the scene length, used when narration audio is absent. */
    minDurationInSeconds: number;
    /** Silence held after the narration ends, so the motion can breathe. */
    tailInSeconds: number;
    /**
     * How the cut into this scene is covered. Omitted on the opening scene,
     * which has nothing to cut from — that is also why the film no longer
     * starts on a white frame.
     */
    enterWith?: TransitionKind;
};

export const SCENES: readonly SceneSpec[] = [
    {
        id: "s00",
        title: "S0 Title",
        narrationFile: "audio/narration/s00.wav",
        narrationText: "",
        captions: ["2026 SEASON"],
        minDurationInSeconds: 3,
        tailInSeconds: 0,
    },
    {
        id: "s01",
        title: "S1 Hook",
        narrationFile: "audio/narration/s01.wav",
        narrationText: "今日も、いい一本が撮れた。",
        captions: [],
        minDurationInSeconds: 7,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s02",
        title: "S2 Grid",
        narrationFile: "audio/narration/s02.wav",
        narrationText:
            "でも、あの日の一本はどこにある。写真アプリの中で、日付だけが積み上がっていく。",
        captions: ["撮った動画は、増えていく。", "あの日の一本が、見つからない。"],
        minDurationInSeconds: 9,
        tailInSeconds: 1.5,
        enterWith: "whip",
    },
    {
        id: "s03",
        title: "S3 Logo",
        narrationFile: "audio/narration/s03.wav",
        narrationText: "SnowLog。滑走動画を、練習ログへ。",
        captions: ["滑走動画を、練習ログへ。"],
        minDurationInSeconds: 6,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s04",
        title: "S4 Import",
        narrationFile: "audio/narration/s04.wav",
        narrationText:
            "滑走動画をまとめて取り込むだけ。GPSから、滑ったゲレンデを自動で推定します。収録は全国378ヶ所。",
        eyebrow: "IMPORT",
        captions: ["まとめて取り込む", "GPSでゲレンデを判定", "全国378ヶ所を収録"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s05",
        title: "S5 Record",
        narrationFile: "audio/narration/s05.wav",
        narrationText:
            "大回り、小回り、コブ。動画に、その日の練習内容を紐づけて残せます。タグもメモも、あとから自由に。",
        eyebrow: "RECORD",
        captions: ["技術・タグ・メモ", "大回り、小回り、コブ", "練習内容を動画に残す"],
        minDurationInSeconds: 12,
        tailInSeconds: 1,
        enterWith: "flash",
    },
    {
        id: "s06",
        title: "S6 Calendar",
        narrationFile: "audio/narration/s06.wav",
        narrationText:
            "滑った日をカレンダーでたどれば、天候も、雪質も、あのときの手応えも、そのまま戻ってきます。",
        eyebrow: "LOOK BACK",
        captions: ["カレンダーと日記", "天候・雪質・感想まで", "滑った日ごとに残す"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s07",
        title: "S7 Dashboard",
        narrationFile: "audio/narration/s07.wav",
        narrationText:
            "一本ずつの記録は、やがてシーズンの手応えになる。どこで何を練習したのかが、数字で見えてきます。",
        eyebrow: "SEASON",
        captions: ["シーズン単位で振り返る", "ゲレンデと技術の傾向", "続けるほど、見えてくる"],
        minDurationInSeconds: 11,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s08",
        title: "S8 Privacy",
        narrationFile: "audio/narration/s08.wav",
        narrationText:
            "データは端末の中だけ。クラウド同期に頼らず、広告も課金もありません。",
        captions: ["オフラインファースト", "データは端末の中だけ", "広告なし・課金なし"],
        minDurationInSeconds: 8,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s09",
        title: "S9 CTA",
        narrationFile: "audio/narration/s09.wav",
        narrationText: "SnowLog、App Store で無料配布中。",
        captions: ["App Store で配布中", "iOS 16+ / 無料"],
        minDurationInSeconds: 7,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
] as const;

/**
 * How many tiles sit in `public/grid/`, named `frame-01.jpg` upward with no
 * gaps. The scene cannot read the filesystem — it runs in the browser — so this
 * has to be stated. `prepare-assets.sh` prints the real count on every run; if
 * the two disagree the render fails loudly on a missing image rather than
 * quietly dropping a tile.
 */
export const GRID_FRAME_COUNT = 8;

export const TOTAL_MIN_SECONDS = SCENES.reduce(
    (total, scene) => total + scene.minDurationInSeconds,
    0,
);

/**
 * Looks up a scene by id. Scenes are prop-free components, so this is how each
 * one reaches its own copy without the strings being duplicated into the scene
 * file — the duplication this replaced had no test keeping the two in step.
 */
export const getScene = (id: SceneId): SceneSpec => {
    const scene = SCENES.find((candidate) => candidate.id === id);

    if (scene === undefined) {
        throw new Error(`Unknown scene id: ${id}`);
    }

    return scene;
};
