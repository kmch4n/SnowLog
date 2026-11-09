export interface BulkImportSummary {
    successCount: number;
    skippedCount: number;
    errorCount: number;
    /** 写真へのアクセス範囲外で取り込まなかった本数（#91） */
    notAccessibleCount: number;
}

let pendingBulkImportSummary: BulkImportSummary | null = null;

export function setPendingBulkImportSummary(summary: BulkImportSummary): void {
    pendingBulkImportSummary = summary;
}

export function consumePendingBulkImportSummary(): BulkImportSummary | null {
    const summary = pendingBulkImportSummary;
    pendingBulkImportSummary = null;
    return summary;
}
