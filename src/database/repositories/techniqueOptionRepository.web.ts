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
