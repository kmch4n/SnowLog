export interface BulkImportSummary {
    successCount: number;
    skippedCount: number;
    errorCount: number;
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
