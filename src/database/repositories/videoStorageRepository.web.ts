/**
 * Web用モックリポジトリ
 * ブラウザでのUIプレビュー用。保存方式の移行は Web では起こらない
 */
import type {
    StorageBackfillPlan,
    StorageBackfillRow,
} from "../../services/videoStorageBackfill";

/** Web のモック動画は最初から reference なので、移行対象は常に空 */
export async function readStorageBackfillRows(): Promise<StorageBackfillRow[]> {
    return [];
}

/** 書き込む先が無いので何もしない */
export async function applyStorageBackfill(
    _plan: StorageBackfillPlan,
    _markerKey: string,
    _markerValue: string
): Promise<void> {
    // no-op
}
