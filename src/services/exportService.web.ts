/**
 * Web用スタブ — expo-file-system / expo-sharing はブラウザ非対応
 */
import { Alert } from "react-native";

export async function exportAllToJSON(): Promise<void> {
    Alert.alert(
        "Web未対応",
        "エクスポート機能はiOSアプリでのみ利用できます。"
    );
}
