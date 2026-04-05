/**
 * Web用スタブ
 * expo-sqlite は Web で動作しないため空実装を返す
 */

export async function getFavoriteResorts(): Promise<string[]> {
    return [];
}

export async function addFavoriteResort(_name: string): Promise<void> {
    // Web では保存しない
}

export async function removeFavoriteResort(_name: string): Promise<void> {
    // Web では保存しない
}
