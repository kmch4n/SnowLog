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
 *
 * 順序そのものは `videoDeletionOrder.ts` が持ち、ここは実体を渡すだけ。
 * このファイルはネイティブ依存を辿るためテストからコンパイルできないので、
 * 順序の検証は `scripts/tests/videoDeletionOrder.test.cjs` が向こう側で行う。
 */
import {
    deleteVideos,
    getVideoById,
} from "@/database/repositories/videoRepository";

import { deleteManagedPath } from "./managedVideoFileService";
import { deleteThumbnail } from "./thumbnailService";
import { runVideoDeletion } from "./videoDeletionOrder";

export async function deleteVideosWithCleanup(videoIds: string[]): Promise<void> {
    await runVideoDeletion(videoIds, {
        getVideo: getVideoById,
        deleteRows: deleteVideos,
        deleteThumbnail,
        deleteManagedPath,
    });
}

/** 1 件だけ削除する。単体経路が独自に順序を決めないための入口 */
export async function deleteVideoWithCleanup(videoId: string): Promise<void> {
    await deleteVideosWithCleanup([videoId]);
}
