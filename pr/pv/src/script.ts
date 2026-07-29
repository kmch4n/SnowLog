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
