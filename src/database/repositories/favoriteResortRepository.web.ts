/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、共有のインメモリストア（`@/mocks/webMockStore`）を読み書きする
 */
import { webMockStore } from "@/mocks/webMockStore";

export async function getFavoriteResorts(): Promise<string[]> {
    return [...webMockStore.favoriteResorts];
}

/** ネイティブと同じく重複は無視する */
export async function addFavoriteResort(name: string): Promise<void> {
    if (!webMockStore.favoriteResorts.includes(name)) webMockStore.favoriteResorts.push(name);
}

export async function removeFavoriteResort(name: string): Promise<void> {
    webMockStore.favoriteResorts = webMockStore.favoriteResorts.filter((row) => row !== name);
}
