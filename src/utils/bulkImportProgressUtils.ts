interface BulkImportRemainingInput {
    completedCount: number;
    totalCount: number;
    elapsedMs: number;
    nowMs: number;
    currentItemStartedAtMs?: number | null;
}

type Translate = (key: string, params: { count: number }) => string;

export function estimateBulkImportRemainingMs({
    completedCount,
    totalCount,
    elapsedMs,
    nowMs,
    currentItemStartedAtMs,
}: BulkImportRemainingInput): number | null {
    if (completedCount <= 0 || totalCount <= 0 || completedCount >= totalCount) {
        return null;
    }

    const averageCompletedMs = elapsedMs / completedCount;
    if (!Number.isFinite(averageCompletedMs) || averageCompletedMs <= 0) {
        return null;
    }

    const remainingItems = totalCount - completedCount;
    const currentElapsedMs =
        currentItemStartedAtMs != null
            ? Math.max(0, nowMs - currentItemStartedAtMs)
            : 0;
    const currentItemRemainingMs =
        currentItemStartedAtMs != null
            ? Math.max(averageCompletedMs - currentElapsedMs, 0)
            : 0;
    const queuedItems =
        currentItemStartedAtMs != null
            ? Math.max(remainingItems - 1, 0)
            : remainingItems;

    return Math.max(
        0,
        Math.round(currentItemRemainingMs + queuedItems * averageCompletedMs)
    );
}

export function formatRemainingTime(ms: number, t: Translate): string {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) {
        return t("import.bulk.remainingSeconds", { count: seconds });
    }

    return t("import.bulk.remainingMinutes", { count: Math.ceil(seconds / 60) });
}
