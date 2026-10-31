/**
 * Web 用: マウス・ペンでドラッグした後の click を捨てる
 *
 * react-native-web の Touchable / Pressable は onPress をブラウザの click イベントで発火する。
 * ネイティブでは RNGH のジェスチャー（スワイプ削除、カレンダーの縦スワイプ）が activate すると
 * 下にある Touchable のタッチは取り消されるが、Web 版 RNGH にはその仕組みがない。そのため
 * マウスで行をスワイプして離すと click が飛び、詳細画面へ遷移したり日付が選ばれたりしていた。
 *
 * タッチではブラウザ自身が「指が動いたらタップではない」と判断して click を出さないので、
 * マウスとペンにも同じ規則を当てる。判定距離は、このアプリで最も小さい RNGH の起動距離
 * （ReanimatedSwipeable の既定 10px）に合わせ、ジェスチャーが動いたときは必ず click を捨てる。
 *
 * Web 専用。`_layout.web.tsx` からだけ使うこと。
 */

const DRAG_CLICK_SLOP_PX = 10;

let installed = false;

/** document に capture フェーズのリスナーを登録する。何度呼んでも 1 回だけ効く */
export function installWebDragClickGuard(): void {
    if (installed || typeof document === "undefined") return;
    installed = true;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let dragged = false;
    let suppressClick = false;

    document.addEventListener(
        "pointerdown",
        (event) => {
            suppressClick = false;
            dragged = false;
            if (event.pointerType === "touch") {
                pointerId = null;
                return;
            }
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
        },
        true
    );

    document.addEventListener(
        "pointermove",
        (event) => {
            if (dragged || event.pointerId !== pointerId) return;
            const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
            if (distance >= DRAG_CLICK_SLOP_PX) {
                dragged = true;
            }
        },
        true
    );

    document.addEventListener(
        "pointerup",
        (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            if (!dragged) return;
            dragged = false;
            // click は pointerup と同じタスクで届く。届かなかった場合に
            // 後続のキーボード操作などの click まで捨てないよう、次のタスクで解除する
            suppressClick = true;
            setTimeout(() => {
                suppressClick = false;
            }, 0);
        },
        true
    );

    document.addEventListener(
        "click",
        (event) => {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );
}
