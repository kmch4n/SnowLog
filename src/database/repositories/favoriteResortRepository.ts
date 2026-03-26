import { eq } from "drizzle-orm";

import { db, favoriteResorts } from "../index";

/**
 * お気に入りスキー場に関するDB操作
 */

/** お気に入りスキー場名の一覧を取得する */
export async function getFavoriteResorts(): Promise<string[]> {
    const rows = await db.select().from(favoriteResorts);
    return rows.map((r) => r.name);
}

/** お気に入りスキー場を追加する（重複は無視） */
export async function addFavoriteResort(name: string): Promise<void> {
    await db.insert(favoriteResorts).values({ name }).onConflictDoNothing();
}

/** お気に入りスキー場を削除する */
export async function removeFavoriteResort(name: string): Promise<void> {
    await db.delete(favoriteResorts).where(eq(favoriteResorts.name, name));
}
