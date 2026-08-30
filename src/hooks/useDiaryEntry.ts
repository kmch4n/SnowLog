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

    /**
     * `isCancelled` は effect から渡す。カレンダーの日付タップには debounce も
     * key による再マウントも無いので取得が重なりやすく、遅れて解決した前の日の
     * 結果で表示中の日記を上書きしないために要る。
     *
     * `setIsLoading(false)` だけは意図的にガードしない。`dateKey == null` の
     * 早期 return は isLoading に触れないため、日付を選んでから取得中に選択を
     * 解除するとガード版ではスピナーが永久に消えなくなる。ガードしない場合の
     * 代償は「前の日の日記がスピナー無しで一瞬見える」だけで、こちらは自然に解消する。
     */
    const refresh = useCallback(
        async (isCancelled: () => boolean = () => false) => {
            if (dateKey == null) {
                if (!isCancelled()) setDiary(null);
                return;
            }
            setIsLoading(true);
            try {
                const entry = await getDiaryEntryByDateKey(dateKey);
                if (!isCancelled()) setDiary(entry as DiaryEntry | null);
            } finally {
                setIsLoading(false);
            }
        },
        [dateKey]
    );

    useEffect(() => {
        let cancelled = false;
        refresh(() => cancelled);
        return () => {
            cancelled = true;
        };
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
