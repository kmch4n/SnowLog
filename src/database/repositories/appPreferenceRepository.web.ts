/**
 * Web用モックリポジトリ
 * ブラウザでのUIプレビュー用にインメモリ Map で代用する
 */
import type { AppPreferenceSelect } from "../schema";

const store = new Map<string, string>();

/** 全設定値を取得する */
export async function getAllPreferences(): Promise<AppPreferenceSelect[]> {
    return Array.from(store.entries()).map(([key, value]) => ({ key, value }));
}

/** 設定値を取得する（未設定の場合は null） */
export async function getPreference(key: string): Promise<string | null> {
    return store.get(key) ?? null;
}

/** 設定値を削除する（存在しない場合は何もしない） */
export async function deletePreference(key: string): Promise<void> {
    store.delete(key);
}

/** 設定値を保存する */
export async function setPreference(key: string, value: string): Promise<void> {
    store.set(key, value);
}
