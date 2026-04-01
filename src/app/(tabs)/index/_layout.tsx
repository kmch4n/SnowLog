import { Stack } from "expo-router";

export default function HomeLayout() {
    return (
        <Stack
            id="home-stack"
            screenOptions={{
                headerStyle: { backgroundColor: "#1A3A5C" },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: "ホーム" }} />
        </Stack>
    );
}
