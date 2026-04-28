import { StyleSheet, View } from "react-native";

import { CalendarDayCell } from "./CalendarDayCell";
import { getDayLabels } from "@/utils/calendarUtils";
import { toDateKey } from "@/utils/dateUtils";
import { useTranslation } from "@/i18n/useTranslation";
import type { DayInfo, WeekStartDay } from "@/types";

interface CalendarWeekStripProps {
    weekDates: Date[];
    selectedDay: number | null;
    dayInfoMap: Map<string, DayInfo>;
    weekStartDay: WeekStartDay;
    onSelectDay: (day: number) => void;
}

/**
 * 週表示カレンダー — 7日間の横並びセル（拡大版）
 */
export function CalendarWeekStrip({
    weekDates,
    selectedDay,
    dayInfoMap,
    weekStartDay,
    onSelectDay,
}: CalendarWeekStripProps) {
    const { locale } = useTranslation();
    const today = new Date();
    const todayKey = toDateKey(Math.floor(today.getTime() / 1000));
    const dayLabels = getDayLabels(weekStartDay, locale);

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {weekDates.map((date, i) => {
                    const day = date.getDate();
                    const dateKey = toDateKey(
                        Math.floor(date.getTime() / 1000)
                    );
                    const jsDay = date.getDay();
                    const isSunday = jsDay === 0;
                    const isSaturday = jsDay === 6;

                    return (
                        <CalendarDayCell
                            key={dateKey}
                            day={day}
                            dateKey={dateKey}
                            isToday={dateKey === todayKey}
                            isSelected={day === selectedDay}
                            dayInfo={dayInfoMap.get(dateKey)}
                            viewMode="week"
                            onPress={onSelectDay}
                            isWeekend={isSaturday || isSunday}
                            isSunday={isSunday}
                            dayLabel={dayLabels[i]}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: "row",
        gap: 2,
    },
});
