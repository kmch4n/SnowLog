/**
 * 孤児ファイル掃除の手順（`orphanedFileCleanupService` が実際のファイルシステムで呼ぶ）
 *
 * 依存を注入する形にしてあるのは、取り込みと掃除が同時に走る順序をテストで再現するため。
 * import を持たない。`scripts/tests/` が素の `tsc` でコンパイルできるようにするため。
 *
 * 取り込みは「保護する → ファイルを書く → 行を入れる → 保護を外す」の順で進む
 * （`importService`）。以前の掃除は最初に一度だけ行を読み、その一覧で消すかを決めていた。
 * 掃除の途中で取り込みが終わると、そのファイルは「行に無い」かつ「もう保護されていない」に
 * 見え、更新時刻が古ければ（コピーで元の時刻が保たれた場合など）唯一のコピーが消えていた。
 *
 * いまは、消す候補を決めたあと、まず同期的に保護中のものを外し、それから行を読み直して、
 * なお参照されていないものだけを消す。候補が保護されていなかったなら、その取り込みは
 * 行を入れ終えている（読み直しで見える）か、そもそも存在しない。
 */

export type CleanupDirectory = "thumbnails" | "videos";

export interface CleanupVideoRow {
    id: string;
    thumbnailUri: string;
    storageMode: string;
    managedVideoPath: string | null;
}

export interface CleanupFileInfo {
    name: string;
    size: number;
    /** 最終更新時刻（ミリ秒） */
    modifiedAtMs: number;
}

export interface OrphanCleanupDeps {
    listVideos(): Promise<CleanupVideoRow[]>;
    /** ディレクトリ直下の通常ファイル。ディレクトリが無ければ空 */
    listFiles(directory: CleanupDirectory): Promise<CleanupFileInfo[]>;
    /** 取り込み中で保護されているか。同期で答える */
    isProtected(directory: CleanupDirectory, fileName: string): boolean;
    deleteFile(directory: CleanupDirectory, fileName: string): Promise<void>;
    /** 行の thumbnailUri が指すファイル名。サムネイルのディレクトリ外なら null */
    thumbnailFileName(stored: string): string | null;
    /** 行の managedVideoPath が指すファイル名 */
    managedFileName(relativePath: string): string | null;
    nowMs(): number;
}

export interface OrphanCleanupCounts {
    deletedThumbnails: number;
    deletedManagedVideos: number;
    deletedBytes: number;
}

interface References {
    thumbnails: Set<string>;
    videos: Set<string>;
    /** パスを失った copy 行の ID（小文字）。そのファイルは手動で戻せるよう消さない */
    pathlessCopyIds: Set<string>;
}

function collectReferences(rows: CleanupVideoRow[], deps: OrphanCleanupDeps): References {
    const refs: References = { thumbnails: new Set(), videos: new Set(), pathlessCopyIds: new Set() };
    for (const row of rows) {
        const thumbnail = deps.thumbnailFileName(row.thumbnailUri);
        if (thumbnail) refs.thumbnails.add(thumbnail);

        // 所有権は行が持つパスだけが決める。パスの無い copy 行（ID の大文字小文字だけが違う
        // 衝突などで移行時にパスを失った行）は何も参照しないが、`videos/<id>.<ext>` は
        // 消さずに残す（#86 §5）
        if (row.managedVideoPath) {
            const managed = deps.managedFileName(row.managedVideoPath);
            if (managed) refs.videos.add(managed);
        } else if (row.storageMode === "copy") {
            refs.pathlessCopyIds.add(row.id.toLowerCase());
        }
    }
    return refs;
}

function isReferenced(refs: References, directory: CleanupDirectory, fileName: string): boolean {
    if (directory === "thumbnails") return refs.thumbnails.has(fileName);
    if (refs.videos.has(fileName)) return true;
    const dot = fileName.lastIndexOf(".");
    const base = (dot > 0 ? fileName.slice(0, dot) : fileName).toLowerCase();
    return refs.pathlessCopyIds.has(base);
}

export async function runOrphanCleanup(
    deps: OrphanCleanupDeps,
    minimumAgeMs: number
): Promise<OrphanCleanupCounts> {
    const before = collectReferences(await deps.listVideos(), deps);

    const candidates: { directory: CleanupDirectory; file: CleanupFileInfo }[] = [];
    for (const directory of ["thumbnails", "videos"] as const) {
        for (const file of await deps.listFiles(directory)) {
            if (isReferenced(before, directory, file.name)) continue;
            // 書いたばかりのファイルは、行がまだ入っていない取り込み途中のものかもしれない
            if (minimumAgeMs > 0 && deps.nowMs() - file.modifiedAtMs < minimumAgeMs) continue;
            candidates.push({ directory, file });
        }
    }

    // 保護の確認は読み直しより前に、同期でまとめて行う（順序が要。ファイル冒頭の説明）
    const unprotected = candidates.filter(
        ({ directory, file }) => !deps.isProtected(directory, file.name)
    );
    if (unprotected.length === 0) {
        return { deletedThumbnails: 0, deletedManagedVideos: 0, deletedBytes: 0 };
    }

    const after = collectReferences(await deps.listVideos(), deps);
    const counts: OrphanCleanupCounts = { deletedThumbnails: 0, deletedManagedVideos: 0, deletedBytes: 0 };
    for (const { directory, file } of unprotected) {
        if (isReferenced(after, directory, file.name)) continue;
        await deps.deleteFile(directory, file.name);
        counts.deletedBytes += file.size;
        if (directory === "thumbnails") counts.deletedThumbnails += 1;
        else counts.deletedManagedVideos += 1;
    }
    return counts;
}
