/**
 * Diary entry predefined options
 */

export interface DiaryOption<T = string> {
    value: T;
    label: string;
    icon?: string;
}

export const WEATHER_OPTIONS: DiaryOption[] = [
    { value: "sunny", label: "晴れ", icon: "☀️" },
    { value: "cloudy", label: "曇り", icon: "☁️" },
    { value: "snowing", label: "雪", icon: "🌨️" },
    { value: "raining", label: "雨", icon: "🌧️" },
    { value: "blizzard", label: "吹雪", icon: "❄️" },
    { value: "foggy", label: "霧", icon: "🌫️" },
];

export const SNOW_CONDITION_OPTIONS: DiaryOption[] = [
    { value: "powder", label: "パウダー" },
    { value: "packed", label: "圧雪" },
    { value: "groomed", label: "整地" },
    { value: "icy", label: "アイスバーン" },
    { value: "wet", label: "湿雪" },
    { value: "spring", label: "春雪" },
    { value: "crud", label: "クラスト" },
    { value: "mogul", label: "コブ" },
];

export const FATIGUE_LEVEL_OPTIONS: DiaryOption<number>[] = [
    { value: 1, label: "元気" },
    { value: 2, label: "やや疲れ" },
    { value: 3, label: "普通" },
    { value: 4, label: "疲れた" },
    { value: 5, label: "ヘトヘト" },
];
