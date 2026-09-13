/**
 * `videos.storage_mode` / `videos.managed_video_path` の初回バックフィルの計画
 *
 * 副作用を持たない純関数だけを置く。DB も Photos もファイルシステムも触らない。
 * 実際の書き込みは `videoStorageRepository.applyStorageBackfill` が 1 つの
 * トランザクションで行い、その呼び出しは `storageMigrationService` が握る。
 *
 * 分けてあるのは、テストのハーネスが `drizzle-orm/sqlite-proxy` 経由で
 * トランザクション境界を発行できないため（#86 §5）。判断のすべてをここに寄せて
 * おけば、トランザクションの有無に関係なく網羅的に検証できる。
 *
 * import は相対のみ。素の `tsc <file>` が通り、emit は `out/services/` へネスト
 * する（`.memory/testing.md`「コンパイル可否は import の形で決まる」）。
 */
import { isSyntheticAssetId } from "../utils/assetId";
import { buildManagedVideoPath } from "../utils/managedVideoPath";
import type { VideoStorageMode } from "../utils/videoStorageMode";

/** バックフィルの入力。DB から読むのはこの 3 列だけで足りる */
export interface StorageBackfillRow {
    id: string;
    assetId: string;
    filename: string;
}

export interface StorageBackfillUpdate {
    id: string;
    storageMode: VideoStorageMode;
    managedVideoPath: string | null;
    /** 1 行の可用性を下げる必要があるときだけ 0。触らないときは null */
    isFileAvailable: number | null;
}

export interface StorageBackfillPlan {
    updates: StorageBackfillUpdate[];
    /** パスが衝突して所有権を手放した行数。手動復旧のために報告する */
    conflictCount: number;
    /** ID が安全でなくパスを組み立てられなかった行数 */
    unsafeCount: number;
}

/**
 * 既存行から更新内容を組み立てる。
 *
 * synthetic な assetId の行は `copy`、それ以外は `reference`。判定は既存の
 * `isSyntheticAssetId` と完全に同じ（大文字小文字を区別する前方一致）で、
 * Photos もファイルの実在も見ない。移行時にネットワークを起こさないため。
 *
 * パスは `buildManagedVideoPath` が既存の命名規約から導く。ファイルが実際に
 * 在るかどうかはここでは判定しない。無い場合は既存の「元ファイルが見つからない」
 * 経路がそのまま働く。
 */
export function planStorageBackfill(
    rows: readonly StorageBackfillRow[]
): StorageBackfillPlan {
    const updates: StorageBackfillUpdate[] = [];
    let unsafeCount = 0;

    for (const row of rows) {
        if (!isSyntheticAssetId(row.assetId)) {
            updates.push({
                id: row.id,
                storageMode: "reference",
                managedVideoPath: null,
                isFileAvailable: null,
            });
            continue;
        }

        const managedVideoPath = buildManagedVideoPath(row.id, row.filename);
        if (managedVideoPath === null) {
            // ID がファイル名として使えない。パスを捏造せず、可用性だけ下げる。
            // ファイルは消さない——復旧はユーザーの判断に委ねる。
            unsafeCount += 1;
            updates.push({
                id: row.id,
                storageMode: "copy",
                managedVideoPath: null,
                isFileAvailable: 0,
            });
            continue;
        }

        updates.push({
            id: row.id,
            storageMode: "copy",
            managedVideoPath,
            isFileAvailable: null,
        });
    }

    return resolvePathConflicts(updates, unsafeCount);
}

/**
 * 同じファイルを 2 行が所有する状態を解消する。
 *
 * basename は動画 ID そのものなので、衝突は ID が大文字小文字だけ異なるときに
 * しか起きない。`randomUUID()` は小文字なので実際にはまず到達しないが、復元された
 * バックアップの ID は信用できないうえ、`videos_managed_video_path_unique` が
 * `lower()` を挟んでいるため、ここで解かないと移行自体が失敗する。
 *
 * 辞書順で最小の ID が所有権を保つ。決定的であることだけが要件で、どちらが勝つ
 * かに意味は無い。負けた行はパスを失い可用性が落ちるが、ファイルは消さない。
 */
function resolvePathConflicts(
    updates: StorageBackfillUpdate[],
    unsafeCount: number
): StorageBackfillPlan {
    const owners = new Map<string, string>();
    for (const update of updates) {
        if (update.managedVideoPath === null) continue;
        const key = update.managedVideoPath.toLowerCase();
        const current = owners.get(key);
        if (current === undefined || update.id < current) {
            owners.set(key, update.id);
        }
    }

    let conflictCount = 0;
    const resolved = updates.map((update) => {
        if (update.managedVideoPath === null) return update;
        const key = update.managedVideoPath.toLowerCase();
        if (owners.get(key) === update.id) return update;

        conflictCount += 1;
        return {
            id: update.id,
            storageMode: update.storageMode,
            managedVideoPath: null,
            isFileAvailable: 0,
        };
    });

    return { updates: resolved, conflictCount, unsafeCount };
}
