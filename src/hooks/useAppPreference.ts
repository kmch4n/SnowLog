import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import {
    getPreference,
    setPreference,
} from "@/database/repositories/appPreferenceRepository";

/**
 * アプリ設定値を読み書きするフック
 * 画面フォーカス時に DB から再読み込みするため、設定変更が即時反映される
 */
export function useAppPreference(
    key: string,
    defaultValue: string
): [string, (value: string) => void] {
    const [value, setValue] = useState(defaultValue);

    // 画面フォーカス時に DB から最新値を読み取る
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            getPreference(key).then((stored) => {
                if (!cancelled && stored !== null) {
                    setValue(stored);
                }
            });
            return () => {
                cancelled = true;
            };
        }, [key])
    );

    const update = useCallback(
        (newValue: string) => {
            setValue(newValue);
            setPreference(key, newValue);
        },
        [key]
    );

    return [value, update];
}
