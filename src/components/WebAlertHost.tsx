/**
 * Web 用の `Alert.alert` 表示先
 *
 * react-native-web の `Alert.alert` は何もしない。Web では確認ダイアログが出ず、削除などの
 * 操作が実行できなかった。`installWebAlert()` が `Alert.alert` を待ち行列
 * （`utils/webAlertQueue.ts`）への投入に差し替え、このコンポーネントが 1 件ずつ表示する。
 *
 * Web 専用。`_layout.web.tsx` からだけ使うこと。ネイティブは OS のアラートをそのまま使う。
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { t } from "@/i18n";
import {
    cancelButtonIndex,
    enqueueWebAlert,
    resolveWebAlert,
    subscribeWebAlert,
    type WebAlertRequest,
} from "@/utils/webAlertQueue";

let installed = false;

/** `Alert.alert` を Web 用の実装に差し替える。何度呼んでも 1 回だけ効く */
export function installWebAlert(): void {
    if (installed) return;
    installed = true;
    Alert.alert = (title, message, buttons) => {
        enqueueWebAlert(title, message, buttons, t("common.ok"));
    };
}

export function WebAlertHost() {
    const [request, setRequest] = useState<WebAlertRequest | null>(null);
    const initialFocusRef = useRef<View>(null);

    useEffect(() => subscribeWebAlert(setRequest), []);

    useEffect(() => {
        if (!request) return;
        // 破壊的な操作の確認では、Enter で削除が走らないようキャンセル側に置く
        (initialFocusRef.current as unknown as HTMLElement | null)?.focus?.();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                resolveWebAlert(request.id, cancelButtonIndex(request));
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [request]);

    if (!request) return null;

    const focusIndex = cancelButtonIndex(request) ?? 0;
    const stacked = request.buttons.length > 2;

    return (
        <Modal transparent visible animationType="fade">
            <View style={styles.backdrop}>
                <View
                    style={styles.card}
                    role="alertdialog"
                    aria-modal
                    aria-label={request.title}
                >
                    <View style={styles.body}>
                        <Text style={styles.title}>{request.title}</Text>
                        {request.message ? (
                            <Text style={styles.message}>{request.message}</Text>
                        ) : null}
                    </View>
                    <View style={stacked ? styles.buttonsStacked : styles.buttonsRow}>
                        {request.buttons.map((button, index) => (
                            <Pressable
                                key={`${request.id}-${index}`}
                                ref={index === focusIndex ? initialFocusRef : undefined}
                                accessibilityRole="button"
                                onPress={() => resolveWebAlert(request.id, index)}
                                style={({ pressed }) => [
                                    styles.button,
                                    stacked ? styles.buttonStacked : styles.buttonInRow,
                                    index > 0 && !stacked && styles.buttonDivider,
                                    pressed && styles.buttonPressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        button.style === "cancel" && styles.buttonTextCancel,
                                        button.style === "destructive" &&
                                            styles.buttonTextDestructive,
                                    ]}
                                >
                                    {button.text ?? t("common.ok")}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: Colors.overlayLight,
    },
    card: {
        width: "100%",
        maxWidth: 320,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: Colors.freshSnow,
    },
    body: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 16,
        gap: 6,
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
        color: Colors.textPrimary,
    },
    message: {
        fontSize: 13,
        textAlign: "center",
        color: Colors.textSecondary,
    },
    buttonsRow: {
        flexDirection: "row",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border,
    },
    buttonsStacked: {
        flexDirection: "column",
    },
    button: {
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
    },
    buttonInRow: {
        flex: 1,
    },
    buttonStacked: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border,
    },
    buttonDivider: {
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: Colors.border,
    },
    buttonPressed: {
        backgroundColor: Colors.frostGray,
    },
    buttonText: {
        fontSize: 17,
        color: Colors.alpineBlue,
    },
    buttonTextCancel: {
        fontWeight: "600",
    },
    buttonTextDestructive: {
        color: Colors.error,
    },
});
