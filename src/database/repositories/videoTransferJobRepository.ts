/**
 * 取得ジョブの永続化（#86 §6）
 *
 * ジョブ表は「まだ `videos` の行になっていない意図」を持つ。完了したジョブは
 * 残さないので、この表の件数はそのまま「未完了の件数」になる。
 */
import { eq, inArray } from "drizzle-orm";

import type { VideoInsert } from "../schema";
import { db, tags, videoTags, videoTransferJobs, videos } from "../index";

export interface VideoTransferJobRow {
    id: string;
    assetId: string;
    kind: string;
    videoId: string;
    state: string;
    payloadJson: string;
    errorCode: string | null;
    createdAt: number;
    updatedAt: number;
}

/** 保持中のジョブを古い順に返す。キュー表示と復旧が使う */
export async function getAllTransferJobs(): Promise<VideoTransferJobRow[]> {
    return db.select().from(videoTransferJobs).orderBy(videoTransferJobs.createdAt);
}

export async function getTransferJobById(
    id: string
): Promise<VideoTransferJobRow | null> {
    const rows = await db
        .select()
        .from(videoTransferJobs)
        .where(eq(videoTransferJobs.id, id))
        .limit(1);
    return rows[0] ?? null;
}

/** 同じアセットのジョブ。二重登録を防ぐために取り込み前に引く */
export async function getTransferJobByAssetId(
    assetId: string
): Promise<VideoTransferJobRow | null> {
    const rows = await db
        .select()
        .from(videoTransferJobs)
        .where(eq(videoTransferJobs.assetId, assetId))
        .limit(1);
    return rows[0] ?? null;
}

export async function insertTransferJob(row: VideoTransferJobRow): Promise<void> {
    await db.insert(videoTransferJobs).values(row);
}

export async function updateTransferJobState(
    id: string,
    state: string,
    errorCode: string | null,
    updatedAt: number
): Promise<void> {
    await db
        .update(videoTransferJobs)
        .set({ state, errorCode, updatedAt })
        .where(eq(videoTransferJobs.id, id));
}

/** 検証済みの出力記述子を payload に焼き込む。rename より前に呼ぶ */
export async function updateTransferJobPayload(
    id: string,
    payloadJson: string,
    updatedAt: number
): Promise<void> {
    await db
        .update(videoTransferJobs)
        .set({ payloadJson, updatedAt })
        .where(eq(videoTransferJobs.id, id));
}

export async function deleteTransferJob(id: string): Promise<void> {
    await db.delete(videoTransferJobs).where(eq(videoTransferJobs.id, id));
}

/**
 * 取り込みを確定させる。行・タグ・ジョブ削除を 1 つのトランザクションで行う。
 *
 * 分けて書くと、動画は入ったのにジョブが残る（キューに幽霊が出る）か、ジョブは
 * 消えたのにタグが付かない（ユーザーが入力した情報を黙って捨てる）という中間
 * 状態ができる。どちらもファイルは既に確定しているので、やり直しでは直らない。
 *
 * タグ ID は挿入の直前に引き直す。選択からここまでの間にタグが消えていたら、
 * 黙って落とさずジョブを残す判断ができるよう `false` を返す。
 */
export async function commitImportedVideoWithTags(
    row: VideoInsert,
    tagIds: number[],
    jobId: string
): Promise<boolean> {
    return db.transaction(async (tx) => {
        if (tagIds.length > 0) {
            const existing = await tx
                .select({ id: tags.id })
                .from(tags)
                .where(inArray(tags.id, tagIds));
            // 選択からここまでの間にタグが消えている。動画だけ入れてタグを
            // 黙って落とすと、ユーザーが入力した情報が理由も告げず消える。
            // 何も書かずに戻り、ジョブは失敗として残す（#86 §6）。
            if (existing.length !== tagIds.length) return false;
        }

        await tx.insert(videos).values(row);
        if (tagIds.length > 0) {
            await tx
                .insert(videoTags)
                .values(tagIds.map((tagId) => ({ videoId: row.id, tagId })));
        }
        await tx.delete(videoTransferJobs).where(eq(videoTransferJobs.id, jobId));
        return true;
    });
}

/**
 * 変換を確定させる。既存行の保存方式だけを差し替え、同じトランザクションで
 * ジョブを消す。
 *
 * 行そのものは作り直さない。ID・メタデータ・タグ・作成日時は変換の前後で
 * 同一でなければならず、消して入れ直すとその保証が消える。
 *
 * @returns 対象行がまだ `reference` として存在していれば true
 */
export async function commitConvertedVideo(
    videoId: string,
    relativePath: string,
    updatedAt: number,
    jobId: string
): Promise<boolean> {
    return db.transaction(async (tx) => {
        const current = await tx
            .select({ storageMode: videos.storageMode })
            .from(videos)
            .where(eq(videos.id, videoId))
            .limit(1);

        // 変換中に行が消された、あるいは既にコピーになっている。どちらの場合も
        // 作り直さない——消された行を復活させるのは利用者の意図に反する。
        if (current.length === 0 || current[0].storageMode !== "reference") {
            await tx.delete(videoTransferJobs).where(eq(videoTransferJobs.id, jobId));
            return false;
        }

        await tx
            .update(videos)
            .set({
                storageMode: "copy",
                managedVideoPath: relativePath,
                isFileAvailable: 1,
                updatedAt,
            })
            .where(eq(videos.id, videoId));
        await tx.delete(videoTransferJobs).where(eq(videoTransferJobs.id, jobId));
        return true;
    });
}
