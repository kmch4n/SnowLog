import { asc, eq, max } from "drizzle-orm";

import { db, techniqueOptions } from "../index";
import type { TechniqueOptionSelect } from "../schema";

/**
 * 滑走種別オプションに関するDB操作をまとめたリポジトリ
 */

/** 全種別を登録順（sortOrder 昇順）で取得する */
export async function getAllTechniqueOptions(): Promise<TechniqueOptionSelect[]> {
    return db.select().from(techniqueOptions).orderBy(asc(techniqueOptions.sortOrder));
}

/**
 * 新しい種別を末尾に追加する
 *
 * 末尾は「いまの最大の sortOrder + 1」。件数を使うと、途中を消した後の追加が
 * 既存の番号と重なり、一覧の途中に入っていた（0,1,2,3,4 から 0 と 1 を消すと 2,3,4 が残り、
 * 件数 3 で追加すると 3 と重なる）。
 */
export async function insertTechniqueOption(name: string): Promise<void> {
    const [{ highest }] = await db
        .select({ highest: max(techniqueOptions.sortOrder) })
        .from(techniqueOptions);
    await db.insert(techniqueOptions).values({ name, sortOrder: (highest ?? -1) + 1 });
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
