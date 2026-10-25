/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、共有のインメモリストア（`@/mocks/webMockStore`）を読み書きする
 */
import { nextId, webMockStore } from "@/mocks/webMockStore";

import type { TechniqueOptionSelect } from "../schema";

export async function getAllTechniqueOptions(): Promise<TechniqueOptionSelect[]> {
    return [...webMockStore.techniqueOptions].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function insertTechniqueOption(name: string): Promise<void> {
    // name の一意制約はネイティブでは例外になる。画面側が重複を弾くので、ここでは無視する
    if (webMockStore.techniqueOptions.some((option) => option.name === name)) return;
    webMockStore.techniqueOptions.push({
        id: nextId("techniqueOptions"),
        name,
        sortOrder: webMockStore.techniqueOptions.length,
    });
}

export async function deleteTechniqueOption(id: number): Promise<void> {
    webMockStore.techniqueOptions = webMockStore.techniqueOptions.filter(
        (option) => option.id !== id
    );
}

// ネイティブ側は Drizzle の同期トランザクションなので Promise を返さない。
// 呼び出し側が await していても無害だが、シグネチャは native に合わせる。
export function reorderTechniqueOptions(orderedIds: number[]): void {
    orderedIds.forEach((id, index) => {
        const option = webMockStore.techniqueOptions.find((row) => row.id === id);
        if (option) option.sortOrder = index;
    });
}

// Web ではバックアップ復元を提供しない（importJsonService.web.ts が先に断る）。
export async function insertTechniqueOptionsForRestore(
    _rows: { name: string; sortOrder: number }[]
): Promise<number> {
    return 0;
}
