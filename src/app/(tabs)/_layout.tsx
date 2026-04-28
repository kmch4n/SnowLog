import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useTranslation } from "@/i18n/useTranslation";

/**
 * タブバーのレイアウト定義
 * NativeTabs を使用し、iOS 26 では Liquid Glass タブバーが自動適用される
 * 各タブのヘッダーはサブフォルダ内の Stack レイアウトで管理する
 */
export default function TabsLayout() {
    const { t } = useTranslation();

    return (
        <NativeTabs>
            <NativeTabs.Trigger name="index">
                <NativeTabs.Trigger.Label>{t("home.title")}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "house", selected: "house.fill" }}
                    md="home"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="dashboard">
                <NativeTabs.Trigger.Label>{t("dashboard.title")}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
                    md="bar_chart"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="calendar">
                <NativeTabs.Trigger.Label>{t("calendar.title")}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf="calendar"
                    md="calendar_today"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="search">
                <NativeTabs.Trigger.Label>{t("search.title")}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf="magnifyingglass"
                    md="search"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="settings">
                <NativeTabs.Trigger.Label>{t("settings.title")}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "gearshape", selected: "gearshape.fill" }}
                    md="settings"
                />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
