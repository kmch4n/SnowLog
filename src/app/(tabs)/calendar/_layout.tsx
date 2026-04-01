import { Stack } from "expo-router";

export default function CalendarLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: "#1A3A5C" },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "カレンダー" }} />
        </Stack>
    );
}
