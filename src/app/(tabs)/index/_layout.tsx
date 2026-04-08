import { Stack } from "expo-router";

import { Colors } from "@/constants/colors";

export default function HomeLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: Colors.headerBg },
                headerTintColor: Colors.headerText,
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "ホーム" }} />
        </Stack>
    );
}
