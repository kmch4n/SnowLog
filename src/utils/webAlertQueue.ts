/**
 * Web 版 `Alert.alert` の待ち行列
 *
 * react-native-web の `Alert.alert` は何もしない空実装で、Web では削除の確認・エラー通知・
 * 並べ替えメニューがすべて無反応になる（確認が出ないので削除そのものが実行できない）。
 * `components/WebAlertHost.tsx` がこの行列を購読して 1 件ずつ表示する。
 *
 * React にも react-native にも依存させないこと。`scripts/tests/` から直接コンパイルして検証する。
 */

export type WebAlertButtonStyle = "default" | "cancel" | "destructive";

export interface WebAlertButton {
    text?: string;
    style?: WebAlertButtonStyle;
    // 引数は渡さない。Alert.prompt の入力値を受け取る形のボタンも、引数なしで呼んで害は無い
    onPress?: () => void;
}

export interface WebAlertRequest {
    id: number;
    title: string;
    message?: string;
    buttons: WebAlertButton[];
}

type Listener = (current: WebAlertRequest | null) => void;

const queue: WebAlertRequest[] = [];
const listeners = new Set<Listener>();
let lastId = 0;

function notify(): void {
    const current = queue[0] ?? null;
    for (const listener of listeners) listener(current);
}

/**
 * `Alert.alert(title, message, buttons)` と同じ引数を受け取る。
 * ボタンが無いときは、ネイティブと同じく「OK」1 つだけのダイアログになる。
 */
export function enqueueWebAlert(
    title: string,
    message?: string,
    buttons?: WebAlertButton[],
    okLabel = "OK"
): void {
    lastId += 1;
    queue.push({
        id: lastId,
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: okLabel }],
    });
    if (queue.length === 1) notify();
}

/**
 * 表示中のダイアログを閉じてから、押されたボタンの `onPress` を呼ぶ。
 * 閉じるのを先にするのは、`onPress` の中から次の `Alert.alert` を出す呼び出し元
 * （削除の失敗を通知する等）があるため。
 */
export function resolveWebAlert(id: number, buttonIndex: number | null): void {
    const current = queue[0];
    if (!current || current.id !== id) return;
    queue.shift();
    notify();
    const button = buttonIndex === null ? undefined : current.buttons[buttonIndex];
    button?.onPress?.();
}

/** Escape など「キャンセル」に当たる操作で押すボタン。cancel スタイルが無ければ閉じるだけ */
export function cancelButtonIndex(request: WebAlertRequest): number | null {
    const index = request.buttons.findIndex((button) => button.style === "cancel");
    if (index >= 0) return index;
    return request.buttons.length === 1 ? 0 : null;
}

export function subscribeWebAlert(listener: Listener): () => void {
    listeners.add(listener);
    listener(queue[0] ?? null);
    return () => {
        listeners.delete(listener);
    };
}
