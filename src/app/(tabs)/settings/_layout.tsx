import { Stack } from "expo-router";

import { Colors } from "@/constants/colors";

export default function SettingsLayout() {
    return (
        <Stack
            id="settings-stack"
            screenOptions={{
                headerStyle: { backgroundColor: Colors.headerBg },
                headerTintColor: Colors.headerText,
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "設定" }} />
        </Stack>
    );
}
