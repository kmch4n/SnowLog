import { Stack } from "expo-router";

export default function CalendarLayout() {
    return (
        <Stack
            id="calendar-stack"
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
