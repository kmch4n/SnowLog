import { useCallback, useEffect, useState } from "react";

import {
    deleteDiaryEntry,
    getDiaryEntryByDateKey,
    upsertDiaryEntry,
} from "@/database/repositories/diaryEntryRepository";
import type { DiaryEntryInsert } from "@/database/schema";
import type { DiaryEntry } from "@/types";

/**
 * 指定日の日記エントリーを管理するフック
 * dateKey が変わると自動的に再フェッチする
 */
export function useDiaryEntry(dateKey: string | null) {
    const [diary, setDiary] = useState<DiaryEntry | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (dateKey == null) {
            setDiary(null);
            return;
        }
        setIsLoading(true);
        try {
            const entry = await getDiaryEntryByDateKey(dateKey);
            setDiary(entry as DiaryEntry | null);
        } finally {
            setIsLoading(false);
        }
    }, [dateKey]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const save = useCallback(
        async (
            data: Omit<DiaryEntryInsert, "id" | "createdAt" | "updatedAt">
        ) => {
            await upsertDiaryEntry(data);
            await refresh();
        },
        [refresh]
    );

    const remove = useCallback(async () => {
        if (dateKey == null) return;
        await deleteDiaryEntry(dateKey);
        setDiary(null);
    }, [dateKey]);

    return { diary, isLoading, save, remove, refresh };
}
