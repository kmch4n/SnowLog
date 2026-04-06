import { useCallback, useState } from "react";

interface UseSelectionModeReturn {
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    selectedCount: number;
    enterSelectionMode: (initialId: string) => void;
    exitSelectionMode: () => void;
    toggleSelection: (id: string) => void;
}

/**
 * Manages multi-select mode state for video lists.
 * Long-press enters selection mode with the initial item selected.
 * Auto-exits when the last item is deselected.
 */
export function useSelectionMode(): UseSelectionModeReturn {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const enterSelectionMode = useCallback((initialId: string) => {
        setIsSelectionMode(true);
        setSelectedIds(new Set([initialId]));
    }, []);

    const exitSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            if (next.size === 0) {
                setIsSelectionMode(false);
            }
            return next;
        });
    }, []);

    return {
        isSelectionMode,
        selectedIds,
        selectedCount: selectedIds.size,
        enterSelectionMode,
        exitSelectionMode,
        toggleSelection,
    };
}
