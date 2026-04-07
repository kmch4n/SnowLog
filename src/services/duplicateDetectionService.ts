import type { VideoWithTags } from "@/types";

export interface DuplicateCandidateGroup {
    id: string;
    confidence: "high" | "medium";
    similarityScore: number;
    reasons: string[];
    videos: VideoWithTags[];
}

interface PairMatch {
    leftId: string;
    rightId: string;
    score: number;
    reasons: string[];
}

function stripTrailingCopyMarkers(filename: string): string {
    let current = filename;

    while (true) {
        const next = current.replace(/(?:[\s_.-]+copy|\(copy\))$/i, "").trimEnd();
        if (next === current) {
            return current;
        }
        current = next;
    }
}

function getCommonPrefixLength(left: string, right: string): number {
    const maxLength = Math.min(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
        if (left[index] !== right[index]) {
            return index;
        }
    }

    return maxLength;
}

function hasStrictPartialFilenameMatch(left: string, right: string): boolean {
    if (left.length < 8 || right.length < 8) {
        return false;
    }

    const minLength = Math.min(left.length, right.length);
    const maxLength = Math.max(left.length, right.length);
    const commonPrefixLength = getCommonPrefixLength(left, right);

    return commonPrefixLength >= 8
        && commonPrefixLength >= Math.ceil(minLength * 0.8)
        && maxLength - minLength <= 2
        && commonPrefixLength < maxLength;
}

function intersectReasons(matches: PairMatch[]): string[] {
    if (matches.length === 0) {
        return [];
    }

    let sharedReasons = [...matches[0].reasons];

    for (const match of matches.slice(1)) {
        sharedReasons = sharedReasons.filter((reason) => match.reasons.includes(reason));
    }

    return sharedReasons;
}

function normalizeFilename(filename: string): string {
    const normalized = stripTrailingCopyMarkers(
        filename
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/\(\d+\)$/g, "")
        .replace(/\s+$/g, "")
    );

    return normalized.replace(/[^a-z0-9]/g, "");
}

function buildPairMatch(left: VideoWithTags, right: VideoWithTags): PairMatch | null {
    const reasons: string[] = [];
    let score = 0;

    const durationDiff = Math.abs(left.duration - right.duration);
    const capturedAtDiff = Math.abs(left.capturedAt - right.capturedAt);
    const leftFilename = normalizeFilename(left.filename);
    const rightFilename = normalizeFilename(right.filename);
    const exactFilenameMatch = leftFilename.length > 0 && leftFilename === rightFilename;
    const partialFilenameMatch = hasStrictPartialFilenameMatch(leftFilename, rightFilename);
    const sameResort =
        left.skiResortName != null
        && right.skiResortName != null
        && left.skiResortName === right.skiResortName;

    if (durationDiff === 0) {
        score += 2;
        reasons.push("長さが一致");
    } else if (durationDiff <= 1) {
        score += 1;
        reasons.push("長さの差が1秒以内");
    } else if (durationDiff <= 2) {
        reasons.push("長さの差が2秒以内");
    }

    if (capturedAtDiff === 0) {
        score += 3;
        reasons.push("撮影時刻が一致");
    } else if (capturedAtDiff <= 5) {
        score += 2;
        reasons.push("撮影時刻の差が5秒以内");
    } else if (capturedAtDiff <= 60) {
        score += 1;
        reasons.push("撮影時刻の差が1分以内");
    }

    if (exactFilenameMatch) {
        score += 3;
        reasons.push("ファイル名がほぼ一致");
    } else if (partialFilenameMatch) {
        score += 1;
        reasons.push("ファイル名が似ている");
    }

    if (sameResort) {
        score += 1;
        reasons.push("スキー場名が一致");
    }

    const shouldMatch =
        (exactFilenameMatch && durationDiff <= 2)
        || (capturedAtDiff <= 5 && durationDiff <= 1)
        || score >= 5;

    if (!shouldMatch) {
        return null;
    }

    return {
        leftId: left.id,
        rightId: right.id,
        score,
        reasons,
    };
}

function buildGroups(
    videos: VideoWithTags[],
    matches: PairMatch[]
): DuplicateCandidateGroup[] {
    const adjacency = new Map<string, Set<string>>();
    const pairByKey = new Map<string, PairMatch>();
    const videoById = new Map(videos.map((video) => [video.id, video]));

    for (const match of matches) {
        if (!adjacency.has(match.leftId)) {
            adjacency.set(match.leftId, new Set());
        }
        if (!adjacency.has(match.rightId)) {
            adjacency.set(match.rightId, new Set());
        }

        adjacency.get(match.leftId)?.add(match.rightId);
        adjacency.get(match.rightId)?.add(match.leftId);

        const key = [match.leftId, match.rightId].sort().join(":");
        pairByKey.set(key, match);
    }

    const visited = new Set<string>();
    const groups: DuplicateCandidateGroup[] = [];

    for (const video of videos) {
        if (visited.has(video.id) || !adjacency.has(video.id)) {
            continue;
        }

        const stack = [video.id];
        const groupIds: string[] = [];

        while (stack.length > 0) {
            const current = stack.pop();
            if (current == null || visited.has(current)) {
                continue;
            }

            visited.add(current);
            groupIds.push(current);

            for (const next of adjacency.get(current) ?? []) {
                if (!visited.has(next)) {
                    stack.push(next);
                }
            }
        }

        if (groupIds.length < 2) {
            continue;
        }

        const groupVideos = groupIds
            .map((id) => videoById.get(id))
            .filter((candidate): candidate is VideoWithTags => candidate != null)
            .sort((left, right) => right.capturedAt - left.capturedAt);

        let highestScore = 0;
        const groupMatches: PairMatch[] = [];

        for (let index = 0; index < groupIds.length; index += 1) {
            for (let nextIndex = index + 1; nextIndex < groupIds.length; nextIndex += 1) {
                const key = [groupIds[index], groupIds[nextIndex]].sort().join(":");
                const match = pairByKey.get(key);
                if (!match) {
                    continue;
                }

                highestScore = Math.max(highestScore, match.score);
                groupMatches.push(match);
            }
        }

        const sharedReasons = intersectReasons(groupMatches);

        groups.push({
            id: groupVideos.map((candidate) => candidate.id).join("-"),
            confidence: highestScore >= 7 ? "high" : "medium",
            similarityScore: highestScore,
            reasons: sharedReasons.length > 0
                ? sharedReasons.slice(0, 4)
                : ["一致条件は動画ごとに異なります"],
            videos: groupVideos,
        });
    }

    return groups.sort((left, right) => {
        if (right.similarityScore !== left.similarityScore) {
            return right.similarityScore - left.similarityScore;
        }
        if (right.videos.length !== left.videos.length) {
            return right.videos.length - left.videos.length;
        }
        return (right.videos[0]?.capturedAt ?? 0) - (left.videos[0]?.capturedAt ?? 0);
    });
}

function compareAndCollectMatch(
    left: VideoWithTags,
    right: VideoWithTags,
    matches: PairMatch[],
    comparedPairKeys: Set<string>
): void {
    const pairKey = [left.id, right.id].sort().join(":");
    if (comparedPairKeys.has(pairKey)) {
        return;
    }

    comparedPairKeys.add(pairKey);

    const match = buildPairMatch(left, right);
    if (match != null) {
        matches.push(match);
    }
}

export function detectDuplicateCandidates(
    videos: VideoWithTags[]
): DuplicateCandidateGroup[] {
    const sortedVideos = [...videos].sort((left, right) => left.capturedAt - right.capturedAt);
    const matches: PairMatch[] = [];
    const comparedPairKeys = new Set<string>();
    const exactFilenameBuckets = new Map<string, VideoWithTags[]>();
    let windowStartIndex = 0;

    for (let index = 0; index < sortedVideos.length; index += 1) {
        const currentVideo = sortedVideos[index];

        while (
            windowStartIndex < index
            && currentVideo.capturedAt - sortedVideos[windowStartIndex].capturedAt > 60
        ) {
            windowStartIndex += 1;
        }

        for (let candidateIndex = windowStartIndex; candidateIndex < index; candidateIndex += 1) {
            compareAndCollectMatch(
                sortedVideos[candidateIndex],
                currentVideo,
                matches,
                comparedPairKeys
            );
        }

        const normalizedFilename = normalizeFilename(currentVideo.filename);
        if (normalizedFilename.length > 0) {
            for (const candidate of exactFilenameBuckets.get(normalizedFilename) ?? []) {
                compareAndCollectMatch(candidate, currentVideo, matches, comparedPairKeys);
            }

            const bucket = exactFilenameBuckets.get(normalizedFilename) ?? [];
            bucket.push(currentVideo);
            exactFilenameBuckets.set(normalizedFilename, bucket);
        }
    }

    return buildGroups(videos, matches);
}
