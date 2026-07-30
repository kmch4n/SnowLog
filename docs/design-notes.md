# SnowLog 設計ノート

技術選定の理由と、設計上の意思決定およびその過程で苦労したことの記録である。
2026-07-30 に [README](../README.md) から技術記述を分離して作成した。

## この文書の位置づけ

SnowLog のドキュメントは役割で分かれている。**本書は「なぜそうしたか」だけを扱う。**
「いまどうなっているか」は仕様書にあるので、内容を重複させない。

| 知りたいこと | 見る場所 |
| --- | --- |
| 現在の実装仕様（データモデル、画面フロー、起動処理、責務分担、i18n、保存ポリシー） | [`SnowLog.md`](../SnowLog.md) |
| **技術選定の理由、設計判断とその経緯** | **本書** |
| 開発規約・コマンド・テストの走らせ方 | [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) / [`.codex/AGENTS.md`](../.codex/AGENTS.md) |
| ドキュメントとコードの既知の乖離 | [`.memory/doc-drift.md`](../.memory/doc-drift.md) |
| テストの方針と落とし穴 | [`.memory/testing.md`](../.memory/testing.md) |
| プロダクトとしての紹介 | [`README.md`](../README.md) |

実装の一次情報は常にコードである。本書と食い違う場合はコードが正しい。

---

## 技術スタックと採用理由

| 技術 | 役割 | 採用理由 |
| --- | --- | --- |
| [Expo SDK 55](https://docs.expo.dev/) / [React Native 0.83.6](https://reactnative.dev/) / [React 19.2](https://react.dev/) | UI フレームワーク | React Compiler を有効化でき、iOS 26 の最新機能（Liquid Glass など）への追従が早いため |
| [Expo Router (NativeTabs)](https://docs.expo.dev/router/introduction/) | ルーティング | `typedRoutes: true` による型安全なルーティングと、iOS 26 の NativeTabs／Liquid Glass タブバーへの追従のため |
| [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) + [Drizzle ORM](https://orm.drizzle.team/) | ローカル DB | 完全オフライン動作を前提に、スキーマ定義・型推論・マイグレーション運用を単一のソースで管理するため |
| [expo-media-library](https://docs.expo.dev/versions/latest/sdk/media-library/) / [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) / [expo-video](https://docs.expo.dev/versions/latest/sdk/video/) / [expo-video-thumbnails](https://docs.expo.dev/versions/latest/sdk/video-thumbnails/) | 動画 I/O | 動画の取り込み・サムネイル生成・再生を Expo エコシステム内で統一するため |
| [expo-file-system/legacy](https://docs.expo.dev/versions/latest/sdk/filesystem/) | ファイル操作 | 新 API は動画共有用途で未成熟だったため、安定している legacy API を明示的に選択 |
| [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) 2.30 + [Reanimated](https://docs.swmansion.com/react-native-reanimated/) 4.2 | ジェスチャ／アニメーション | 長押し選択・滑らかなリストインタラクションのため |
| [react-native-draggable-flatlist](https://github.com/computerjazz/react-native-draggable-flatlist) | 並び替え UI | 滑走種別マスタのドラッグ＆ドロップ並び替えのため |
| [i18n-js](https://github.com/fnando/i18n) v4 + [expo-localization](https://docs.expo.dev/versions/latest/sdk/localization/) | 国際化 | App Store の非日本語ストア向けフォールバック表示と、UI の日英切替を統一エンジンで提供するため |
| [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) | 触覚フィードバック | ネイティブ流儀の操作感（一括選択開始・削除確定・インポート完了など）を実現するため |
| [EAS Dev Build](https://docs.expo.dev/develop/development-builds/introduction/) | ビルド基盤 | SDK 55 は Expo Go 非対応のため、Dev Client ベースで開発する必要があるため |

バージョンの一次情報は `package.json` である。Expo SDK 55 では `expo-sqlite` などのモジュールも
SDK と同じメジャー番号（`~55.x`）で配布されるため、モジュール単体の旧バージョン番号は記載しない。

---

## アーキテクチャの俯瞰

各層の責務の詳細は [`SnowLog.md` §9](../SnowLog.md) にある。ここでは全体の形だけ示す。

上位層から DB までを単方向に積み上げ、責務を分離している。

```
UI (src/app, src/components)
  ↓
Hooks (useVideos / useVideoDetail / useDashboard / useCalendarEnhanced / useDiaryEntry / useSelectionMode)
  ↓
Services (importService / thumbnailService / duplicateDetectionService / exportService / videoDeletionService)
  ↓
Repositories (videoRepo / tagRepo / diaryEntryRepo / dashboardRepo / favoriteResortRepo / techniqueOptionRepo / appPreferenceRepo)
  ↓
Database (expo-sqlite + Drizzle ORM)
```

動画取り込みは、この層をまたぐ最も長いフローである。

```
video-import.tsx
  → importService (EXIF/GPS 抽出・重複除外)
  → mediaService.getAssetInfo (iCloud ダウンロード含む)
  → thumbnailService (サムネイル生成)
  → geoUtils (GPS → ゲレンデ判定)
  → videoRepository (SQLite へ永続化)
```

---

## 設計上の意思決定と苦労したこと

### 1. オフラインファースト × 参照型ストレージ

滑走動画は 1 本あたり 50〜500MB に達する大容量ファイルで、端末の写真ライブラリに既に存在している。
これをクラウド同期したり、アプリ内にコピーしたりすれば、通信コストと端末ストレージ消費が即座に限界を超える。

この制約を踏まえ、**クラウド同期を導入せず、`expo-sqlite` + Drizzle ORM によるローカル完結構成とし、
動画本体は移動・複製せず `assetId` で参照のみ持つ** 設計に振り切った。
サムネイルと「管理コピー」のみを `documentDirectory` に配置する。

ただし参照型には副作用があり、次の点で苦労した。

- **iCloud 未ダウンロードアセット**への対応が必要だった。取り込み時に `shouldDownloadFromNetwork` を指定してオンデマンド取得させ、UI 側では進捗を表示する導線を追加した。
- **ユーザーが写真アプリ側で元動画を削除した場合**、参照切れが発生する。これを検出するため `isFileAvailable` フラグを導入し、`updateFileAvailability` による健全性チェックを通じて、参照切れ動画が表示されてもアプリ全体がクラッシュしない導線を `useVideoDetail` 側で徹底した。
- **「一切複製しない」は正確ではない。** 写真ライブラリのアセットとして扱えない動画（`assetId` が `synthetic:` 始まり）に限り、`managedVideoFileService.persistManagedVideoFile()` が動画本体を `documentDirectory/videos/` へ複製する。この複製は動画削除時とアンインストール時に消える。保存ポリシーの全体は [`SnowLog.md` §10](../SnowLog.md) にある。

結果として、ネットワーク不要・初期同期ゼロで即起動でき、通常の写真ライブラリ動画については
端末ストレージを二重消費しないアプリとして成立している。

### 2. GPS からのゲレンデ自動判定と、動画の重複検出

ユーザーに毎回ゲレンデ名を手入力させるのは UX が致命的に悪い。また、過去動画をまとめて取り込むと
重複動画の山が発生することも避けられない。この二点を同時に解く必要があった。

**ゲレンデ判定**では、`src/constants/skiResorts.json` に日本全国 378 ゲレンデの座標データを内蔵し、
動画の EXIF から取得した GPS 座標と **Haversine 距離による最近傍マッチング** で候補を提示する方式を採った。
単一候補に絞れる場合は自動適用し、複数候補が競合する場合は `GpsConfirmationDialog` で
ユーザーに確認させるハイブリッド UX とした。

**重複検出**では、`duplicateDetectionService.ts` で撮影日時差・動画長差・ファイル名類似度を
重み付きでスコアリングし、高信頼度／中信頼度の 2 段階で分類する設計にした
（判定ロジックの詳細は [`SnowLog.md` §8](../SnowLog.md)）。

これらで苦労した点は次の通りである。

- GPS 座標が欠損した動画（屋内撮影、古い機種、プライバシー設定により除去されたもの）に対するフォールバック導線の整備。
- 日本のスキーエリアは隣接ゲレンデが密集する（例: 白馬エリア）ため、単純な最近傍では誤判定が発生する。距離閾値と候補リストの両方を UI 側で扱えるよう API を設計し直した。
- 重複検出は「誤検出で動画を消してしまう」リスクが極めて大きい。そのため自動削除は行わず、**候補提示 + 明示的な一括アクション** に分離し、設定画面 `settings/duplicate-candidates.tsx` を独立させて安全側に倒した。

結果として、取り込み時のゲレンデ入力はほぼ自動化され、重複候補は設定画面から安全にクリーンアップできる。

### 3. 初モバイル開発での UI 設計試行錯誤

本プロジェクトは開発者にとって初のモバイルアプリ開発であり、Web とは異なる設計原則
（タブナビゲーション、ジェスチャ主体の操作、セーフエリア、ハプティクス）のすべてが初体験であった。
結果として、ナビゲーションバーからホーム画面まで、**アプリ全体の UI が試行錯誤の対象**となった。

試行錯誤した主な領域は次の通りである。

- **ナビゲーション構成**: 「ホーム / 統計 / カレンダー / 検索 / 設定」の 5 タブに定着するまでに、ホーム単一画面から機能を分離する過程で数度組み換えた。最終的には Expo Router の `NativeTabs` + Liquid Glass タブバーに移行した。
- **ホーム画面の情報密度**: 「動画一覧 + お気に入り」をセグメント切替で一画面にまとめるか、別画面に分離するかを検討した末、`SectionList` によるゲレンデ別グルーピング + セグメント切替に収束した。
- **一括操作の導線**: 長押し選択モードへの遷移、`BulkActionToolbar` による操作集約、選択解除のジェスチャを `useSelectionMode` フックに抽象化した。
- **横スワイプによるタブ切替**: 一度導入したが、動画カード側のジェスチャと干渉したため撤回した（commit [`a79b563`](https://github.com/kmch4n/SnowLog/commit/a79b563)）。やってみて外す判断も設計の一部である。

この過程で得た最大の学びは、**Web で通用した「ボタンを並べれば伝わる」設計はモバイルでは密度過剰になる**
という点である。ジェスチャと FAB、長押し選択、画面階層の分割を優先する方向に頭を切り替える必要があった。
加えて、iOS 26 の Liquid Glass 効果を活かしつつコントラスト低下による可読性低下を起こさない調整にも神経を使った。

結果として、ネイティブ流儀（タブ + ジェスチャ + FAB + 長押し選択）に沿った UI に収束している。
段階的な撤回と収束の履歴はコミット単位で残っており、判断の試行錯誤そのものが成果でもある。

---

## 紹介映像のビルド

README とランディングページに載せている紹介映像は、[Remotion](https://www.remotion.dev/) 製の
独立プロジェクト `pr/pv/` で構成している（本体とは別の `node_modules` を持つ）。

- 台詞と尺は `pr/pv/src/script.ts` を単一の情報源とし、シーンの長さはナレーション音声の実測値から導出する。台詞を編集すると尺が自動的に再計算される。
- ナレーションはローカルの TTS で合成し、**全 9 行を 1 本の参照クリップからクローンする**。これが「全編を通して同一話者に聞こえる」ことを担保している。設計の根拠と測定結果は [`.memory/pv-narration-voice.md`](../.memory/pv-narration-voice.md) にある。
- 端末モックの画面は、Apple 公式ベゼル画像のアルファチャンネルをそのままマスクとして使う。角が真円ではなくスクワークルであるため、CSS の `border-radius` では一致しない。
- `pr/pv/public/` は生成物であり git 管理外。素材の原本は `.temp/` に置く。したがって clone しただけでは映像を再ビルドできない。

手順の詳細は [`pr/pv/public/README.md`](../pr/pv/public/README.md) を参照。

ランディングページは Astro 製で `pr/web/` にある。`npm run build` の出力 `dist/` を
静的ファイルサーバへ配置する運用で、自動デプロイは構成していない。
