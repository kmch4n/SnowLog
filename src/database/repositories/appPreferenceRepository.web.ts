/**
 * Web用モックリポジトリ
 * ブラウザでのUIプレビュー用にインメモリ Map で代用する
 */

const store = new Map<string, string>();

/** 設定値を取得する（未設定の場合は null） */
export async function getPreference(key: string): Promise<string | null> {
    return store.get(key) ?? null;
}

/** 設定値を保存する */
export async function setPreference(key: string, value: string): Promise<void> {
    store.set(key, value);
}
