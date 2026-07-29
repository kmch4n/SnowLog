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
        narrationText: "今日も、いい一本が撮れました。",
        captions: [],
        minDurationInSeconds: 7,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s02",
        title: "S2 Grid",
        narrationFile: "audio/narration/s02.wav",
        narrationText: "でも、あの日の一本がどこにあるのか、すぐには思い出せません。日付だけが積み上がっていきます。",
        captions: ["撮った動画は増えていきます", "あの日の一本が見つかりません"],
        minDurationInSeconds: 10,
        tailInSeconds: 1.5,
        enterWith: "whip",
    },
    {
        id: "s03",
        title: "S3 Logo",
        narrationFile: "audio/narration/s03.wav",
        narrationText: "SnowLog は、滑走動画を練習の記録として残すアプリです。",
        captions: ["滑走動画を、練習の記録に変えます"],
        minDurationInSeconds: 8,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s04",
        title: "S4 Import",
        narrationFile: "audio/narration/s04.wav",
        narrationText: "動画をまとめて選ぶだけで取り込みが終わります。GPSの位置情報から、滑ったゲレンデも自動で判定します。",
        eyebrow: "IMPORT",
        captions: ["まとめて取り込めます", "ゲレンデは自動で判定します", "全国378か所に対応しています"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s05",
        title: "S5 Record",
        narrationFile: "audio/narration/s05.wav",
        narrationText: "大回りや小回り、コブといった滑走種別を、動画ごとに設定できます。タグやメモも後から書き足せます。",
        eyebrow: "RECORD",
        captions: ["滑走種別を設定できます", "タグやメモも残せます", "後から書き足せます"],
        minDurationInSeconds: 12,
        tailInSeconds: 1,
        enterWith: "flash",
    },
    {
        id: "s06",
        title: "S6 Calendar",
        narrationFile: "audio/narration/s06.wav",
        narrationText: "カレンダーから滑った日をたどると、その日の天気や雪質、書き残した感想までまとめて振り返れます。",
        eyebrow: "LOOK BACK",
        captions: ["カレンダーから振り返れます", "天気や雪質も残せます", "その日の感想も書けます"],
        minDurationInSeconds: 11,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s07",
        title: "S7 Dashboard",
        narrationFile: "audio/narration/s07.wav",
        narrationText: "記録が積み重なると、シーズン全体の傾向が見えてきます。どこでどの種目を練習したのかが、数字でわかります。",
        eyebrow: "SEASON",
        captions: ["シーズン全体を見渡せます", "練習の傾向がわかります", "続けるほど見えてきます"],
        minDurationInSeconds: 11,
        tailInSeconds: 1.5,
        enterWith: "snow",
    },
    {
        id: "s08",
        title: "S8 Privacy",
        narrationFile: "audio/narration/s08.wav",
        narrationText: "データはすべて端末の中に保存され、外部には送信されません。広告も課金もありません。",
        captions: ["データは端末の中だけです", "外部には送信しません", "広告も課金もありません"],
        minDurationInSeconds: 9,
        tailInSeconds: 1,
        enterWith: "whip",
    },
    {
        id: "s09",
        title: "S9 CTA",
        narrationFile: "audio/narration/s09.wav",
        narrationText: "SnowLog は App Store から無料でダウンロードできます。",
        captions: ["App Store で配布中です", "iOS 16 以上・無料"],
        minDurationInSeconds: 9,
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
