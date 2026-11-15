import { useCallback, useEffect, useRef, useState } from "react";

import { createDebouncedTask } from "@/utils/debouncedTask";

export type AutosaveStatus = "idle" | "saving" | "saved";

/** 入力が止まってから保存するまで */
const AUTOSAVE_DELAY_MS = 1000;
/** 「保存しました」を表示しておく時間 */
const SAVED_STATUS_MS = 2000;

export interface AutosavedText {
    value: string;
    status: AutosaveStatus;
    /** TextInput の onChangeText に渡す。保存を予約するのはここだけ */
    onChangeText: (text: string) => void;
    /** 行から読んだ値を入れる。保存は予約しない */
    seed: (text: string) => void;
    /** 保留中の保存を今すぐ実行する（別の動画へ切り替える前など） */
    flush: () => void;
    /** 保留中の保存を捨てる（行を削除したあと） */
    cancel: () => void;
}

/**
 * 入力から 1 秒後に自動保存するテキスト欄の状態（動画詳細のタイトルとメモ）
 *
 * - 保存の予約はユーザーの入力からだけ行う。行からの値の流し込み（`seed`）は保存しない。
 * - 予約した保存は、予約した描画時点の `save` を使う。呼び出し側の `save` が別の動画に
 *   束縛し直されても、入力していた動画に書く。
 * - アンマウント時は保留中の保存を捨てずに実行する（入力から 1 秒以内に戻っても編集が残る）。
 * - 保存に失敗したら「保存中」で固まらせず idle に戻す。入力欄の文字は残り、次の入力でまた保存する。
 */
export function useAutosavedText(save: (text: string) => Promise<unknown>): AutosavedText {
    const [value, setValue] = useState("");
    const [status, setStatus] = useState<AutosaveStatus>("idle");
    const [task] = useState(() => createDebouncedTask(AUTOSAVE_DELAY_MS));
    // 「保存しました」を消すタイマー。入力が変わったときに前回分を消さないと、
    // 古いタイマーが新しい保存の表示を早めに消してしまう。
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onChangeText = useCallback(
        (text: string) => {
            setValue(text);
            if (statusTimerRef.current) {
                clearTimeout(statusTimerRef.current);
            }
            setStatus("idle");
            task.schedule(async () => {
                setStatus("saving");
                try {
                    await save(text);
                } catch {
                    setStatus("idle");
                    return;
                }
                setStatus("saved");
                statusTimerRef.current = setTimeout(() => setStatus("idle"), SAVED_STATUS_MS);
            });
        },
        [task, save]
    );

    // 画面を離れるとき、保留中の保存は捨てずに今すぐ実行する
    useEffect(() => {
        return () => {
            task.flush();
            if (statusTimerRef.current) {
                clearTimeout(statusTimerRef.current);
            }
        };
    }, [task]);

    return {
        value,
        status,
        onChangeText,
        seed: setValue,
        flush: task.flush,
        cancel: task.cancel,
    };
}
