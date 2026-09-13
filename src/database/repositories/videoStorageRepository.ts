/**
 * 保存方式（`videos.storage_mode` / `videos.managed_video_path`）の読み書き
 *
 * `videoRepository` と分けてあるのは、こちらが移行と所有権のためのもので、
 * 通常の CRUD とは寿命も呼び出し元も違うため。
 */
import { eq } from "drizzle-orm";

import type { StorageBackfillPlan, StorageBackfillRow } from "../../services/videoStorageBackfill";
import { appPreferences, db, videos } from "../index";

/** バックフィルに要る 3 列だけを読む */
export async function readStorageBackfillRows(): Promise<StorageBackfillRow[]> {
    return db
        .select({
            id: videos.id,
            assetId: videos.assetId,
            filename: videos.filename,
        })
        .from(videos);
}

/**
 * 計画を 1 つのトランザクションで適用し、同じトランザクションで移行マーカーを書く。
 *
 * マーカーを分けて書くと、更新は通ったのにマーカーだけ落ちた場合に次回起動で
 * 全行を書き直すことになる。冪等ではあるが、その間に利用者が変えた保存方式を
 * 巻き戻してしまう。
 */
export async function applyStorageBackfill(
    plan: StorageBackfillPlan,
    markerKey: string,
    markerValue: string
): Promise<void> {
    await db.transaction(async (tx) => {
        for (const update of plan.updates) {
            const values: {
                storageMode: string;
                managedVideoPath: string | null;
                isFileAvailable?: number;
            } = {
                storageMode: update.storageMode,
                managedVideoPath: update.managedVideoPath,
            };
            if (update.isFileAvailable !== null) {
                values.isFileAvailable = update.isFileAvailable;
            }

            await tx.update(videos).set(values).where(eq(videos.id, update.id));
        }

        await tx
            .insert(appPreferences)
            .values({ key: markerKey, value: markerValue })
            .onConflictDoUpdate({
                target: appPreferences.key,
                set: { value: markerValue },
            });
    });
}
