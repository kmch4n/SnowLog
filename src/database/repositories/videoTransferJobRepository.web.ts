/**
 * Web用モックリポジトリ
 * ブラウザでのUIプレビュー用。取得ジョブは Web では発生しない
 */
import type { VideoInsert } from "../schema";

export interface VideoTransferJobRow {
    id: string;
    assetId: string;
    kind: string;
    videoId: string;
    state: string;
    payloadJson: string;
    errorCode: string | null;
    createdAt: number;
    updatedAt: number;
}

export async function getAllTransferJobs(): Promise<VideoTransferJobRow[]> {
    return [];
}

export async function getTransferJobById(
    _id: string
): Promise<VideoTransferJobRow | null> {
    return null;
}

export async function getTransferJobByAssetId(
    _assetId: string
): Promise<VideoTransferJobRow | null> {
    return null;
}

export async function insertTransferJob(
    _row: VideoTransferJobRow
): Promise<void> {
    // no-op
}

export async function updateTransferJobState(
    _id: string,
    _state: string,
    _errorCode: string | null,
    _updatedAt: number
): Promise<void> {
    // no-op
}

export async function updateTransferJobPayload(
    _id: string,
    _payloadJson: string,
    _updatedAt: number
): Promise<void> {
    // no-op
}

export async function deleteTransferJob(_id: string): Promise<void> {
    // no-op
}

export async function commitImportedVideoWithTags(
    _row: VideoInsert,
    _tagIds: number[],
    _jobId: string
): Promise<boolean> {
    return false;
}

export async function commitConvertedVideo(
    _videoId: string,
    _relativePath: string,
    _updatedAt: number,
    _jobId: string
): Promise<boolean> {
    return false;
}
