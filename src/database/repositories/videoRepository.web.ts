/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、ブラウザでのUIプレビュー用にモックデータを返す
 */
import type { FilterOptions, VideoWithTags } from "../../types";
import type { VideoInsert } from "../schema";

const MOCK_VIDEOS: VideoWithTags[] = [
    {
        id: "mock-1",
        assetId: "asset-1",
        filename: "hakuba_carving_run.mov",
        thumbnailUri: "",
        duration: 45,
        capturedAt: 1706774400,
        skiResortName: "白馬八方尾根スキー場",
        memo: "カービングの練習。外足荷重を意識してターンの弧を大きくした。次回は上体の先行動作を改善したい。",
        isFileAvailable: 1,
        createdAt: 1706800000,
        updatedAt: 1706800000,
        tags: [
            { id: 1, name: "大回り", type: "technique" },
            { id: 3, name: "カービング", type: "technique" },
        ],
    },
    {
        id: "mock-2",
        assetId: "asset-2",
        filename: "zao_mogul_practice.mp4",
        thumbnailUri: "",
        duration: 28,
        capturedAt: 1707638400,
        skiResortName: "蔵王温泉スキー場",
        memo: "コブに入ったが吸収が追いつかなかった。ストックワークを見直す必要がある。",
        isFileAvailable: 1,
        createdAt: 1707660000,
        updatedAt: 1707660000,
        tags: [
            { id: 2, name: "小回り", type: "technique" },
            { id: 4, name: "コブ", type: "technique" },
        ],
    },
    {
        id: "mock-3",
        assetId: "asset-3",
        filename: "niseko_powder_run.mov",
        thumbnailUri: "",
        duration: 62,
        capturedAt: 1708848000,
        skiResortName: "ニセコグランヒラフ",
        memo: "50cmのパウダー。重心を少し後ろに引いて浮力を確保。最高のコンディションだった。",
        isFileAvailable: 1,
        createdAt: 1708870000,
        updatedAt: 1708870000,
        tags: [{ id: 5, name: "パウダー", type: "technique" }],
    },
];

export async function insertVideo(_data: VideoInsert): Promise<void> {
    // Web では保存しない
}

export async function getVideoById(id: string): Promise<VideoWithTags | null> {
    return MOCK_VIDEOS.find((v) => v.id === id) ?? null;
}

export async function getVideoByAssetId(_assetId: string): Promise<null> {
    return null;
}

export async function getVideosByFilter(options: FilterOptions = {}): Promise<VideoWithTags[]> {
    let result = [...MOCK_VIDEOS];

    if (options.skiResortName) {
        result = result.filter((v) => v.skiResortName === options.skiResortName);
    }
    if (options.dateFrom) {
        result = result.filter((v) => v.capturedAt >= options.dateFrom!);
    }
    if (options.dateTo) {
        result = result.filter((v) => v.capturedAt <= options.dateTo!);
    }
    if (options.searchText) {
        const q = options.searchText.toLowerCase();
        result = result.filter((v) => v.filename.toLowerCase().includes(q));
    }
    if (options.tagIds && options.tagIds.length > 0) {
        result = result.filter((v) => v.tags.some((t) => options.tagIds!.includes(t.id)));
    }

    return result.sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function updateVideoMeta(
    _id: string,
    _data: { memo?: string; skiResortName?: string | null }
): Promise<void> {
    // Web では保存しない
}

export async function updateFileAvailability(_id: string, _isAvailable: boolean): Promise<void> {
    // Web では保存しない
}

export async function deleteVideo(_id: string): Promise<void> {
    // Web では保存しない
}

export async function getAllVideos(): Promise<VideoWithTags[]> {
    return [...MOCK_VIDEOS].sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function updateVideoCapturedAt(_id: string, _capturedAt: number): Promise<void> {
    // Web stub
}
