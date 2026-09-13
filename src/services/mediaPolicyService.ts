/**
 * 取得ポリシー（ユーザーが選ぶ優先軸）の読み書き（#86 §3.1）
 *
 * 既定値を持たない。未設定は「まだ選んでいない」という意味であり、`save_space`
 * に正規化してはいけない——選ばせる前に参照方式で走り出すと、初回の取り込みで
 * 意図しない通信が起きる。ネットワークを使う取得は未設定のとき fail-closed。
 */
import {
    getPreference,
    setPreference,
} from "../database/repositories/appPreferenceRepository";
import type { MediaPriority } from "../types/media";

/** `app_preferences` のキー。`weekStartDay` だけが camelCase の歴史的例外 */
export const MEDIA_PRIORITY_KEY = "media_priority";

function isMediaPriority(value: unknown): value is MediaPriority {
    return value === "save_space" || value === "save_data";
}

/**
 * 選択済みの優先軸。未設定・不正値はどちらも null。
 *
 * 不正値を既定へ倒さないのは、倒した先が「通信してよい方」になりうるため。
 * 読めない値は選んでいないのと同じに扱う。
 */
export async function readMediaPriority(): Promise<MediaPriority | null> {
    const stored = await getPreference(MEDIA_PRIORITY_KEY);
    return isMediaPriority(stored) ? stored : null;
}

/**
 * 優先軸を保存する。**書き込みが成功してから**成功として扱うこと。
 * 書けていないのに UI を進めると、次回起動で選択が消えている。
 */
export async function setMediaPriority(priority: MediaPriority): Promise<void> {
    await setPreference(MEDIA_PRIORITY_KEY, priority);
}

/** 選択済みなら true。初回の取り込みを出してよいかの判定に使う */
export async function hasMediaPriority(): Promise<boolean> {
    return (await readMediaPriority()) !== null;
}
