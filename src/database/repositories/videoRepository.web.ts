/**
 * Web mock repository used for UI previews when SQLite is unavailable.
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
        skiResortName: "Hakuba Happo-One",
        memo: "Focused on edge control and smoother transitions.",
        title: null,
        techniques: ["large-turns", "carving"],
        isFileAvailable: 1,
        isFavorite: 1,
        createdAt: 1706800000,
        updatedAt: 1706800000,
        tags: [
            { id: 1, name: "Large Turns", type: "technique" },
            { id: 3, name: "Carving", type: "technique" },
        ],
    },
    {
        id: "mock-2",
        assetId: "asset-2",
        filename: "zao_mogul_practice.mp4",
        thumbnailUri: "",
        duration: 28,
        capturedAt: 1707638400,
        skiResortName: "Zao Onsen",
        memo: "Practiced rhythm and absorption on the mogul line.",
        title: null,
        techniques: ["short-turns", "moguls"],
        isFileAvailable: 1,
        isFavorite: 0,
        createdAt: 1707660000,
        updatedAt: 1707660000,
        tags: [
            { id: 2, name: "Short Turns", type: "technique" },
            { id: 4, name: "Moguls", type: "technique" },
        ],
    },
    {
        id: "mock-3",
        assetId: "asset-3",
        filename: "niseko_powder_run.mov",
        thumbnailUri: "",
        duration: 62,
        capturedAt: 1708848000,
        skiResortName: "Niseko Grand Hirafu",
        memo: "Deep powder run with a stable forward stance.",
        title: null,
        techniques: ["powder"],
        isFileAvailable: 1,
        isFavorite: 0,
        createdAt: 1708870000,
        updatedAt: 1708870000,
        tags: [{ id: 5, name: "Powder", type: "technique" }],
    },
];

export async function insertVideo(_data: VideoInsert): Promise<void> {
    return;
}

export async function getVideoById(id: string): Promise<VideoWithTags | null> {
    return MOCK_VIDEOS.find((video) => video.id === id) ?? null;
}

export async function getVideoByAssetId(_assetId: string): Promise<null> {
    return null;
}

export async function getVideosByFilter(options: FilterOptions = {}): Promise<VideoWithTags[]> {
    let result = [...MOCK_VIDEOS];

    if (options.skiResortName) {
        result = result.filter((video) => video.skiResortName === options.skiResortName);
    }
    if (options.dateFrom) {
        result = result.filter((video) => video.capturedAt >= options.dateFrom!);
    }
    if (options.dateTo) {
        result = result.filter((video) => video.capturedAt <= options.dateTo!);
    }
    if (options.searchText) {
        const query = options.searchText.toLowerCase();
        result = result.filter(
            (video) =>
                video.filename.toLowerCase().includes(query) ||
                (video.title?.toLowerCase().includes(query) ?? false) ||
                video.memo.toLowerCase().includes(query)
        );
    }
    if (options.tagIds && options.tagIds.length > 0) {
        result = result.filter((video) =>
            video.tags.some((tag) => options.tagIds!.includes(tag.id))
        );
    }
    if (options.favoritesOnly) {
        result = result.filter((video) => video.isFavorite === 1);
    }

    return result.sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function updateVideoMeta(
    _id: string,
    _data: {
        memo?: string;
        skiResortName?: string | null;
        title?: string | null;
        techniques?: string | null;
    }
): Promise<void> {
    return;
}

export async function toggleFavorite(_id: string, _isFavorite: boolean): Promise<void> {
    return;
}

export async function updateFileAvailability(_id: string, _isAvailable: boolean): Promise<void> {
    return;
}

export async function deleteVideo(_id: string): Promise<void> {
    return;
}

export async function getAllVideos(): Promise<VideoWithTags[]> {
    return [...MOCK_VIDEOS].sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function updateVideoCapturedAt(_id: string, _capturedAt: number): Promise<void> {
    return;
}
