import { useEffect, useState } from "react";

import {
    getRecentSkiResortNames,
    getSkiResortNamesForCapturedDay,
} from "@/database/repositories/videoRepository";
import { useTranslation } from "@/i18n/useTranslation";

export interface SkiResortSuggestionGroup {
    key: string;
    label: string;
    names: string[];
}

interface UseSkiResortSuggestionsOptions {
    capturedAt: number | null;
    excludeVideoId?: string;
    currentValue?: string | null;
}

function excludeCurrentValue(names: string[], currentValue?: string | null): string[] {
    const normalizedCurrentValue = currentValue?.trim();
    if (!normalizedCurrentValue) return names;
    return names.filter((name) => name !== normalizedCurrentValue);
}

export function useSkiResortSuggestions({
    capturedAt,
    excludeVideoId,
    currentValue,
}: UseSkiResortSuggestionsOptions): SkiResortSuggestionGroup[] {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<SkiResortSuggestionGroup[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function loadSuggestions(): Promise<void> {
            const [sameDayNames, recentNames] = await Promise.all([
                capturedAt != null
                    ? getSkiResortNamesForCapturedDay(capturedAt, excludeVideoId)
                    : Promise.resolve([]),
                getRecentSkiResortNames(3),
            ]);

            if (cancelled) return;

            const sameDay = excludeCurrentValue(sameDayNames, currentValue);
            const recent = excludeCurrentValue(
                recentNames.filter((name) => !sameDay.includes(name)),
                currentValue
            );

            setGroups([
                ...(sameDay.length > 0
                    ? [{
                        key: "same-day",
                        label: t("components.skiResortSearch.sameDayHeader"),
                        names: sameDay,
                    }]
                    : []),
                ...(recent.length > 0
                    ? [{
                        key: "recent",
                        label: t("components.skiResortSearch.recentHeader"),
                        names: recent,
                    }]
                    : []),
            ]);
        }

        loadSuggestions().catch(() => {
            if (!cancelled) setGroups([]);
        });

        return () => {
            cancelled = true;
        };
    }, [capturedAt, currentValue, excludeVideoId, t]);

    return groups;
}
