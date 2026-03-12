import { Tabs } from "expo-router";

/**
 * タブバーのレイアウト定義
 */
export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: "#1A3A5C",
                tabBarInactiveTintColor: "#AAAAAA",
                tabBarStyle: {
                    backgroundColor: "#FFFFFF",
                    borderTopColor: "#E0E0E0",
                },
                headerStyle: { backgroundColor: "#1A3A5C" },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "ホーム",
                    tabBarLabel: "ホーム",
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: "検索",
                    tabBarLabel: "検索",
                }}
            />
        </Tabs>
    );
}
