/**
 * Web用スタブ
 * expo-sqlite は Web で動作しないため空実装を返す
 */
import type { TechniqueOptionSelect } from "../schema";

export async function getAllTechniqueOptions(): Promise<TechniqueOptionSelect[]> {
    return [];
}

export async function insertTechniqueOption(_name: string): Promise<void> {
    // Web では保存しない
}

export async function deleteTechniqueOption(_id: number): Promise<void> {
    // Web では保存しない
}

// ネイティブ側は Drizzle の同期トランザクションなので Promise を返さない。
// 呼び出し側が await していても無害だが、シグネチャは native に合わせる。
export function reorderTechniqueOptions(_orderedIds: number[]): void {
    // Web では保存しない
}

export async function insertTechniqueOptionsForRestore(
    _rows: { name: string; sortOrder: number }[]
): Promise<number> {
    return 0;
}
