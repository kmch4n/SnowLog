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

/** Persist a new sort order for all technique options */
export function reorderTechniqueOptions(orderedIds: number[]): void {
    db.transaction((tx) => {
        for (let i = 0; i < orderedIds.length; i++) {
            tx.update(techniqueOptions)
                .set({ sortOrder: i })
                .where(eq(techniqueOptions.id, orderedIds[i]))
                .run();
        }
    });
}

/**
 * バックアップ復元用に種別を挿入する。既存の name はスキップし、書き込んだ件数を返す。
 *
 * `insertTechniqueOption` は sortOrder を現在の件数から算出するため復元に使えない。
 * バックアップ側の並び順をそのまま持ち込む必要がある。
 */
export async function insertTechniqueOptionsForRestore(
    rows: { name: string; sortOrder: number }[]
): Promise<number> {
    let inserted = 0;
    for (const row of rows) {
        const result = await db.insert(techniqueOptions).values(row).onConflictDoNothing();
        if (result.changes === 1) inserted += 1;
    }
    return inserted;
}
