import { Stack } from "expo-router";

export default function SettingsLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: "#1A3A5C" },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "設定" }} />
        </Stack>
    );
}
