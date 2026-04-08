import { Stack } from "expo-router";

import { Colors } from "@/constants/colors";

export default function SearchLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: Colors.headerBg },
                headerTintColor: Colors.headerText,
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "検索" }} />
        </Stack>
    );
}
