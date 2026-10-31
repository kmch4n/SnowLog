/**
 * Web プレビュー用のインメモリストア
 *
 * Web では SQLite を使わず、各リポジトリの `.web.ts` がこのストアを読み書きする。
 * 以前はリポジトリごとに固定のモック配列を持ち、書き込みはすべて何もしなかったため、
 * 削除・お気に入り・タグ削除・並べ替えを押しても画面が変わらず、動作確認にならなかった
 * （Issue #74 の受け入れ条件）。ここに 1 つの状態としてまとめ、ネイティブと同じ形の行を返す。
 *
 * - 行の形はネイティブのリポジトリが返す生の行に合わせる。特に `videos.techniques` は
 *   JSON 文字列で持つ。フックが `parseTechniques` で文字列として読むため、配列で返すと
 *   滑走種別が常に空になる。
 * - 状態はページの再読み込みで初期値に戻る。永続化はしない。
 * - Web 専用。`.web.ts` からだけ import すること（ネイティブのバンドルに入れない）。
 */
import { DEFAULT_TECHNIQUE_OPTIONS } from "@/constants/techniques";
import { getCurrentSeason, toDateKey } from "@/utils/dateUtils";
import type {
    DiaryEntrySelect,
    TagSelect,
    TechniqueOptionSelect,
    VideoSelect,
} from "@/database/schema";

/**
 * モックの撮影日は「現在のシーズン」の中に置く。ダッシュボードは現在のシーズンを
 * 既定で開くので、固定の過去日付だと Web の統計が常に空になる。
 */
const SEASON_END_YEAR = getCurrentSeason().endYear;

function seasonDate(month: number, day: number, hour: number, minute: number): number {
    return Math.floor(new Date(SEASON_END_YEAR, month - 1, day, hour, minute).getTime() / 1000);
}

const HAKUBA_AT = seasonDate(1, 18, 9, 30);
const ZAO_AT = seasonDate(2, 8, 10, 15);
const NISEKO_AT = seasonDate(2, 22, 13, 40);
const SEED_CREATED_AT = HAKUBA_AT + 3600;

function video(
    row: Omit<
        VideoSelect,
        "thumbnailUri" | "isFileAvailable" | "storageMode" | "managedVideoPath" | "updatedAt"
    >
): VideoSelect {
    return {
        ...row,
        thumbnailUri: "",
        isFileAvailable: 1,
        storageMode: "reference",
        managedVideoPath: null,
        updatedAt: row.createdAt,
    };
}

function seedVideos(): VideoSelect[] {
    return [
        video({
            id: "mock-1",
            assetId: "asset-1",
            filename: "hakuba_carving_run.mov",
            duration: 45,
            capturedAt: HAKUBA_AT,
            skiResortName: "白馬八方尾根スキー場",
            memo: "Focused on edge control and smoother transitions.",
            title: null,
            techniques: JSON.stringify(["大回り", "カービング"]),
            isFavorite: 1,
            createdAt: SEED_CREATED_AT,
        }),
        video({
            id: "mock-2",
            assetId: "asset-2",
            filename: "zao_mogul_practice.mp4",
            duration: 28,
            capturedAt: ZAO_AT,
            skiResortName: "山形蔵王温泉スキー場",
            memo: "Practiced rhythm and absorption on the mogul line.",
            title: null,
            techniques: JSON.stringify(["小回り", "コブ"]),
            isFavorite: 0,
            createdAt: ZAO_AT + 3600,
        }),
        video({
            id: "mock-3",
            assetId: "asset-3",
            filename: "niseko_powder_run.mov",
            duration: 62,
            capturedAt: NISEKO_AT,
            skiResortName: "ニセコマウンテンリゾート グラン・ヒラフ",
            memo: "Deep powder run with a stable forward stance.",
            title: null,
            techniques: JSON.stringify(["パウダー"]),
            isFavorite: 0,
            createdAt: NISEKO_AT + 3600,
        }),
    ];
}

function seedTags(): TagSelect[] {
    return [
        { id: 1, name: "大回り", type: "technique" },
        { id: 2, name: "小回り", type: "technique" },
        { id: 3, name: "カービング", type: "technique" },
        { id: 4, name: "コブ", type: "technique" },
        { id: 5, name: "パウダー", type: "technique" },
        { id: 6, name: "フリー", type: "technique" },
        { id: 7, name: "田中コーチ", type: "skier" },
        { id: 8, name: "山田さん", type: "skier" },
        { id: 9, name: "検定練習", type: "custom" },
        { id: 10, name: "朝イチ", type: "custom" },
    ];
}

function seedVideoTags(): { videoId: string; tagId: number }[] {
    return [
        { videoId: "mock-1", tagId: 1 },
        { videoId: "mock-1", tagId: 3 },
        { videoId: "mock-1", tagId: 7 },
        { videoId: "mock-1", tagId: 9 },
        { videoId: "mock-2", tagId: 2 },
        { videoId: "mock-2", tagId: 4 },
        { videoId: "mock-3", tagId: 5 },
        { videoId: "mock-3", tagId: 10 },
    ];
}

function seedTechniqueOptions(): TechniqueOptionSelect[] {
    return DEFAULT_TECHNIQUE_OPTIONS.map((name, index) => ({
        id: index + 1,
        name,
        sortOrder: index,
    }));
}

function seedDiaryEntries(): DiaryEntrySelect[] {
    return [
        {
            id: 1,
            dateKey: toDateKey(HAKUBA_AT),
            skiResortName: "白馬八方尾根スキー場",
            weather: "sunny",
            snowCondition: "packed",
            impressions: "Good grip in the morning, softer after noon.",
            temperature: -4,
            companions: "田中コーチ",
            fatigueLevel: 3,
            expenses: 6500,
            numberOfRuns: 14,
            createdAt: SEED_CREATED_AT,
            updatedAt: SEED_CREATED_AT,
        },
    ];
}

/** ストア本体。各 `.web.ts` リポジトリはここを直接読み書きする */
export const webMockStore = {
    videos: seedVideos(),
    tags: seedTags(),
    videoTags: seedVideoTags(),
    techniqueOptions: seedTechniqueOptions(),
    favoriteResorts: ["白馬八方尾根スキー場"],
    diaryEntries: seedDiaryEntries(),
    preferences: new Map<string, string>(),
};

type AutoIncrementTable = "tags" | "techniqueOptions" | "diaryEntries";

const lastIds: Record<AutoIncrementTable, number> = {
    tags: Math.max(...webMockStore.tags.map((row) => row.id)),
    techniqueOptions: Math.max(...webMockStore.techniqueOptions.map((row) => row.id)),
    diaryEntries: Math.max(...webMockStore.diaryEntries.map((row) => row.id)),
};

/** 自動採番。ネイティブの AUTOINCREMENT と同じく、削除済みの番号は再利用しない */
export function nextId(table: AutoIncrementTable): number {
    lastIds[table] += 1;
    return lastIds[table];
}

export function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}
