/**
 * Web用モック。Web に写真ライブラリ取得は無いので、常に未選択を返す。
 */
import type { MediaPriority } from "../types/media";

export const MEDIA_PRIORITY_KEY = "media_priority";

export async function readMediaPriority(): Promise<MediaPriority | null> {
    return null;
}

export async function setMediaPriority(_priority: MediaPriority): Promise<void> {
    // no-op
}

export async function hasMediaPriority(): Promise<boolean> {
    return false;
}
