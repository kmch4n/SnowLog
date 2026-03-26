import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";

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
                    height: 62,
                    paddingBottom: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
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
                    tabBarIcon: ({ color, focused }) => (
                        <SymbolView
                            name={focused ? "house.fill" : "house"}
                            tintColor={color}
                            size={24}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: "カレンダー",
                    tabBarLabel: "カレンダー",
                    tabBarIcon: ({ color }) => (
                        <SymbolView name="calendar" tintColor={color} size={24} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: "検索",
                    tabBarLabel: "検索",
                    tabBarIcon: ({ color }) => (
                        <SymbolView name="magnifyingglass" tintColor={color} size={24} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: "設定",
                    tabBarLabel: "設定",
                    tabBarIcon: ({ color, focused }) => (
                        <SymbolView
                            name={focused ? "gearshape.fill" : "gearshape"}
                            tintColor={color}
                            size={24}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
