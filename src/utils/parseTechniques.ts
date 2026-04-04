/**
 * Safely parse the techniques JSON column.
 * Returns string[] on success, null on failure or empty.
 */
export function parseTechniques(raw: string | null): string[] | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
                (item): item is string => typeof item === "string"
            );
            return filtered.length > 0 ? filtered : null;
        }
        return null;
    } catch {
        return null;
    }
}
