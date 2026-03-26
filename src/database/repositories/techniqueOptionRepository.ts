import { asc, count, eq } from "drizzle-orm";

import { db, techniqueOptions } from "../index";
import type { TechniqueOptionSelect } from "../schema";

/**
 * 滑走種別オプションに関するDB操作をまとめたリポジトリ
 */

/** 全種別を登録順（sortOrder 昇順）で取得する */
export async function getAllTechniqueOptions(): Promise<TechniqueOptionSelect[]> {
    return db.select().from(techniqueOptions).orderBy(asc(techniqueOptions.sortOrder));
}

/** 新しい種別を末尾に追加する */
export async function insertTechniqueOption(name: string): Promise<void> {
    const [{ total }] = await db.select({ total: count() }).from(techniqueOptions);
    await db.insert(techniqueOptions).values({ name, sortOrder: total });
}

/** 種別を削除する */
export async function deleteTechniqueOption(id: number): Promise<void> {
    await db.delete(techniqueOptions).where(eq(techniqueOptions.id, id));
}
