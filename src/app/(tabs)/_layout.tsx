import { NativeTabs } from "expo-router/unstable-native-tabs";

/**
 * タブバーのレイアウト定義
 * NativeTabs を使用し、iOS 26 では Liquid Glass タブバーが自動適用される
 * 各タブのヘッダーはサブフォルダ内の Stack レイアウトで管理する
 */
export default function TabsLayout() {
    return (
        <NativeTabs>
            <NativeTabs.Trigger name="index">
                <NativeTabs.Trigger.Label>ホーム</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "house", selected: "house.fill" }}
                    md="home"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="calendar">
                <NativeTabs.Trigger.Label>カレンダー</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf="calendar"
                    md="calendar_today"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="search">
                <NativeTabs.Trigger.Label>検索</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf="magnifyingglass"
                    md="search"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="settings">
                <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "gearshape", selected: "gearshape.fill" }}
                    md="settings"
                />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
