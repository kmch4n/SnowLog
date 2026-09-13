/**
 * 動画レコードと、その所有ファイルの削除
 *
 * 単体削除も一括削除もここを通す。以前は詳細画面が自前で同じ手順を書いており、
 * 順序が片方だけずれても誰も気づけなかった。
 *
 * **順序が要件**: 先に DB の行を消し、そのあとファイルを消す。
 *
 * 逆順だと、ファイル削除に失敗した時点で「行は生きているのに実体が無い」状態が
 * 残る。ユーザーには動画として見えるのに再生できず、しかも掃除の対象にもならない。
 * 行を先に消しておけば、最悪の結果は参照されないファイルが 1 つ残ることで、
 * これは `orphanedFileCleanupService` が回収できる（#86 §6）。
 */
import {
    deleteVideos,
    getVideoById,
} from "@/database/repositories/videoRepository";

import { deleteManagedPath } from "./managedVideoFileService";
import { deleteThumbnail } from "./thumbnailService";

export async function deleteVideosWithCleanup(videoIds: string[]): Promise<void> {
    if (videoIds.length === 0) {
        return;
    }

    const targets = await Promise.all(videoIds.map((id) => getVideoById(id)));
    const owned = targets.filter(
        (video): video is NonNullable<typeof video> => video !== null
    );

    // 所有ファイルの一覧は行を消す前に確定させる。消したあとでは引けない。
    const filesToDelete: Promise<void>[] = [];
    for (const video of owned) {
        if (video.thumbnailUri) {
            filesToDelete.push(deleteThumbnail(video.thumbnailUri));
        }
        // パスが無い copy 行（移行時に ID が安全でなかったもの）は、消すべき
        // ファイルを特定できない。捏造したパスで消しに行くより孤児として残す。
        if (video.managedVideoPath) {
            filesToDelete.push(deleteManagedPath(video.managedVideoPath));
        }
    }

    await deleteVideos(videoIds);

    // ここから先の失敗は回収可能な孤児しか生まない。await はするが、結果は
    // 呼び出し元に影響させない——行はもう消えており、やり直す対象が無い。
    await Promise.allSettled(filesToDelete);
}

/** 1 件だけ削除する。単体経路が独自に順序を決めないための入口 */
export async function deleteVideoWithCleanup(videoId: string): Promise<void> {
    await deleteVideosWithCleanup([videoId]);
}
