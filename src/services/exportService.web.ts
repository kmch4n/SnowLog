/**
 * Web用スタブ — expo-file-system / expo-sharing はブラウザ非対応
 */
import { Alert } from "react-native";

import { t } from "../i18n";

export async function exportAllToJSON(): Promise<void> {
    Alert.alert(
        t("settings.export.webUnsupportedTitle"),
        t("settings.export.webUnsupportedBody")
    );
}
