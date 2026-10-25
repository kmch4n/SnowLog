/**
 * 動画の行と所有ファイルを消す順序（`videoDeletionService` の中身）
 *
 * 依存はすべて引数で受け取る。DB もファイルシステムもここには無いので、
 * 順序と失敗時の挙動を実機なしで検証できる（`videoTransferRunner.ts` と同じ形）。
 *
 * **順序が仕様**: 行を消し終えるまで、ファイルの削除を 1 つも始めない。
 * 「消すべきファイルの一覧」は行を消す前に確定させるが、確定させるのは
 * パスだけで、削除の呼び出しではない。呼び出した時点で削除は走り出すので、
 * 一覧づくりの中で呼ぶと行の削除が失敗しても実体はもう消えている。
 *
 * import を持たない。素の `tsc <file>` が通る（`.memory/testing.md`）。
 */

/** 行が所有するファイル。行を消したあとでは引けないので先に読む */
export interface VideoOwnedFiles {
    /** `""` はサムネイル欠損の番兵で、消すものが無い */
    thumbnailUri: string;
    /** パスが無い copy 行は消すべきファイルを特定できない */
    managedVideoPath: string | null;
}

export interface VideoDeletionDeps {
    getVideo(videoId: string): Promise<VideoOwnedFiles | null>;
    deleteRows(videoIds: string[]): Promise<void>;
    deleteThumbnail(stored: string): Promise<void>;
    deleteManagedPath(relativePath: string): Promise<void>;
}

export async function runVideoDeletion(
    videoIds: string[],
    deps: VideoDeletionDeps
): Promise<void> {
    if (videoIds.length === 0) {
        return;
    }

    const targets = await Promise.all(videoIds.map((id) => deps.getVideo(id)));

    // 削除を「まだ呼んでいない関数」として溜める。ここで呼ぶと走り出してしまう。
    const fileDeletions: (() => Promise<void>)[] = [];
    for (const video of targets) {
        if (video === null) continue;
        const { thumbnailUri, managedVideoPath } = video;
        if (thumbnailUri) {
            fileDeletions.push(() => deps.deleteThumbnail(thumbnailUri));
        }
        if (managedVideoPath) {
            fileDeletions.push(() => deps.deleteManagedPath(managedVideoPath));
        }
    }

    // ここで投げたら、ファイルには一切触れていない。行も実体も残るので、
    // ユーザーはそのままやり直せる。
    await deps.deleteRows(videoIds);

    // ここから先の失敗は回収可能な孤児しか生まない。await はするが、結果は
    // 呼び出し元に影響させない——行はもう消えており、やり直す対象が無い。
    // async で包むのは、同期的に投げる削除関数も拒否として閉じ込めるため。
    await Promise.allSettled(fileDeletions.map(async (run) => run()));
}
