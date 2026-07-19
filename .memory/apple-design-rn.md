---
title: Apple フルードインターフェース原則の RN 適用規約
updated: 2026-07-19
status: active
---

# Apple フルードインターフェース原則の RN 適用規約

WWDC「Designing Fluid Interfaces」(2018) 等の設計原則を SnowLog（Reanimated 4 / RNGH / iOS 主対象）向けに翻訳した規約。
新規のアニメーション・ジェスチャー・押下フィードバックを書くときはここに従う。

## Spring 既定値

- アニメーションは原則 `withSpring` を使う。固定 duration の `withTiming` はフェード等の非空間的な変化のみ。
- 設定値は `src/constants/motion.ts` の定数（`SPRING_DEFAULT` / `SPRING_MOMENTUM`）を使い、インラインで数値を書かない。
  - `SPRING_DEFAULT`: critically damped（`dampingRatio: 1`, `duration: 350`）。通常の UI 遷移すべて。オーバーシュートしない。
  - `SPRING_MOMENTUM`: `dampingRatio: 0.8`, `duration: 350`。**ユーザーのフリック/スロー等、運動量を持つジェスチャーの着地のみ**。タップで出るメニューが跳ねるのは誤り。

## Reduced Motion

- Reanimated の `with*` / entering / exiting / layout は**デフォルトで `ReduceMotion.System` を尊重する**。追加の `.reduceMotion(System)` 指定は不要（no-op）。
- **`ReduceMotion.Never` の明示指定は禁止**（理解を助ける opacity 変化などに限り、理由コメント付きで例外可）。
- **RN core の `LayoutAnimation` は禁止**。Reduce Motion を無視するため。Reanimated の `layout={LinearTransition...}` 等で代替する。

## ジェスチャー原則

- ドラッグ中は 1:1 トラッキング。掴んだ位置のオフセットを尊重し、要素中心にスナップさせない。
- release 時のコミット/キャンセル判定は **velocity を第一基準**にし、ゆっくりした意図的なドラッグを拾うために距離しきい値を補助に使う（velocity OR 距離。位置だけで判定しない）。実例: `src/app/(tabs)/calendar/index.tsx` の `shouldCommit`。
- release 後の spring には gesture の velocity を `withSpring(target, { ...config, velocity })` で引き渡し、指とアニメーションの継ぎ目を消す。
- 割り込み可能にする: アニメーション中も入力をロックしない。再アニメーションは常に現在の表示値（SharedValue の現在値）から始める。
- 境界では rubber-band（進行に応じた減衰）。ハードストップさせない。
- FlatList / ScrollView と共存する Pan は `activeOffsetY` 等で意図判定してから activate する。

## ハプティクス

- 必ず `services/hapticsService.ts` 経由（既存規約）。因果イベントと同フレームで発火し、意味のある瞬間（成功・エラー・コミット・スナップ）に限る。
- RNGH コンポーネントでは JS コールバック（例: `ReanimatedSwipeable` の `onSwipeableOpenStartDrag`）を優先する。worklet から `runOnJS` で発火する構成は、JS コールバックで代替できない場合の最終手段。

## 素材（Liquid Glass）

- 半透明面は `components/ui/GlassSurface.tsx` 経由（既存規約）。半透明面の上に半透明面を重ねない。
- `isInteractive` な GlassView はネイティブの押下フィードバックを持つ。**`PressableScale` 等の追加押下アニメーションを重ねない**（FAB が該当）。

## 押下フィードバック

- 主要ボタンは `components/ui/PressableScale.tsx` を使う: press-in の瞬間（touch-up ではなく）に scale 0.97 へ、release で復帰。
- 新規ボタンで `TouchableOpacity activeOpacity` を増やさない（既存分の移行は漸進的でよい）。

## Dynamic Type

- テキストのフォントスケーリングを無効化しない。レイアウトが壊れる箇所は `maxFontSizeMultiplier` で上限を設ける（本文には設けない）。
