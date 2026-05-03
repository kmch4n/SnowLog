import type { Tag, VideoWithTags } from "../types";

function areStringArraysEqual(a: string[] | null, b: string[] | null): boolean {
    if (a === b) {
        return true;
    }
    if (a == null || b == null || a.length !== b.length) {
        return false;
    }

    return a.every((value, index) => value === b[index]);
}

function areTagsEqual(a: Tag[], b: Tag[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((tag, index) => {
        const other = b[index];

        return (
            other != null &&
            tag.id === other.id &&
            tag.name === other.name &&
            tag.type === other.type
        );
    });
}

function areVideosEqual(a: VideoWithTags, b: VideoWithTags): boolean {
    return (
        a.id === b.id &&
        a.assetId === b.assetId &&
        a.filename === b.filename &&
        a.thumbnailUri === b.thumbnailUri &&
        a.duration === b.duration &&
        a.capturedAt === b.capturedAt &&
        a.skiResortName === b.skiResortName &&
        a.memo === b.memo &&
        a.title === b.title &&
        areStringArraysEqual(a.techniques, b.techniques) &&
        a.isFileAvailable === b.isFileAvailable &&
        a.isFavorite === b.isFavorite &&
        a.createdAt === b.createdAt &&
        a.updatedAt === b.updatedAt &&
        areTagsEqual(a.tags, b.tags)
    );
}

export function areVideoListsEqual(
    current: VideoWithTags[],
    next: VideoWithTags[]
): boolean {
    if (current.length !== next.length) {
        return false;
    }

    return current.every((video, index) => {
        const other = next[index];

        return other != null && areVideosEqual(video, other);
    });
}
