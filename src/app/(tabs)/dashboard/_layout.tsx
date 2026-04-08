import { Stack } from "expo-router";

import { Colors } from "@/constants/colors";

export default function DashboardLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: Colors.headerBg },
                headerTintColor: Colors.headerText,
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "統計" }} />
        </Stack>
    );
}
