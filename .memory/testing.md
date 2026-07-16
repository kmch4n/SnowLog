---
title: テストの実態と実行方法
updated: 2026-07-15
status: active
---

# テストの実態と実行方法

## テストは存在するが `npm test` では走らない

**`scripts/tests/` に `node:test` ベースのテストが 8 ファイル・49 ケースある**（2026-07-16 時点）。

かつて `.codex/AGENTS.md` と `.claude/CLAUDE.md` は「自動テストは無い」と書いていたが、
2026-07-15 に両方とも実態へ修正済み。**現在はどちらの記述も正しい**ので、乖離として扱わなくてよい。
気づきにくさの原因は、いまはドキュメントではなく次の点にある。

- `bulkImportProgressUtils.test.cjs`
- `calendarUtils.test.cjs`
- `dateUtils.test.cjs`
- `homeSwipeDelete.test.cjs`
- `parseTechniques.test.cjs`
- `versionUtils.test.cjs`
- `videoDetailKeyboardAccessory.test.cjs`
- `videoListEquality.test.cjs`

`package.json` に `test` script が**定義されていない**ため、`npm test` では走らず存在に気づきにくい。

## 実行方法

```bash
node --test "scripts/tests/*.test.cjs"
```

glob をクォートで囲むこと。**`node --test scripts/tests/` のようなディレクトリ指定は Node 25 / Windows で `MODULE_NOT_FOUND` になり動かない**（2026-07-15 に確認）。

## 全 49 件 pass（2026-07-16 時点）

かつて `homeSwipeDelete.test.cjs` の「iOS-style icon and compact system red surface」ケースが
main で 1 件落ち続けていた。原因は**テストの陳腐化**（動作の退行ではない）。
`b908ad3` がスワイプ削除とテストを同時に追加した当時、`VideoCardCompact.tsx` は `expo-symbols` を直接 import しており、
テストはその正確なスナップショットだった。翌日 `d8cb778` がアイコンを `@/components/ui/Icon` ラッパー経由に refactor した際、
`scripts/tests/` を 1 行も更新しなかったための取り残し。

これを 2026-07-16 に解消した（コミット `aa9134c`）。ただし**期待値を Icon ラッパーに追随させるだけでは同じ罠を張り直す**
（`import { Icon } from "./ui/Icon"` を期待させても `@/` エイリアスに変えた瞬間また落ちる）。
そのためテストは「有効な契約」だけに絞り、**「窓口を迂回していないか」の検査は lint に移した**（次節）。

教訓: テストが落ちたら、まず自分の変更が原因か、それとも既存の取り残しかを、ベースラインを取って切り分けること。

## テストの性質は 2 種類ある — 一括りにしないこと

方式が異なる。**「SnowLog のテストはソース文字列を見ているだけ」は誤り**（2026-07-15 に実地確認）。
振る舞い検証が 6 本・正規表現が 2 本で、いまや前者が多数派。

| 方式 | ファイル | 性質 |
| --- | --- | --- |
| **振る舞いを検証**（6 本） | `versionUtils` / `bulkImportProgressUtils` / `videoListEquality` / `parseTechniques` / `calendarUtils` / `dateUtils` | `tsc` で対象 `.ts` を temp dir にコンパイル → `require` → 実際に関数を呼んで `assert`。信頼できる |
| **ソース正規表現**（2 本） | `homeSwipeDelete` / `videoDetailKeyboardAccessory` | `readFileSync` + `assert.match`。実装の書き方を固定するスナップショット |

正規表現方式の 2 本だけが次の弱点を持つ。

- 振る舞いが正しくても、書き方を変えた（抽象化した・変数名を変えた）だけで落ちる
- 逆に、書き方さえ合っていれば実際に壊れていても通る

リファクタでこの 2 本が落ちたら、まず**テストが実装の変更に追随していないだけではないか**を疑う。
実際 `homeSwipeDelete` の失敗はこれ（上記）。一方、振る舞い検証の 3 本が落ちたら**本物の退行を疑ってよい**。

## アーキテクチャ上の単一窓口は lint で守る（テストではない）

`expo-symbols` は `src/components/ui/Icon.tsx`、`expo-haptics` は `src/services/hapticsService.ts` からのみ
import してよい、という規約がある（`.claude/CLAUDE.md` に明文化）。これを機械的に守るのは**テストではなく `eslint.config.js` の
`no-restricted-imports`**（2026-07-16 追加、コミット `95711da`）。

なぜ lint か:
- `npm run lint` は PR 前必須の既存ゲート。`node --test` は npm script すら無く気づかれにくい（上記）。窓口ガードは気づかれる方に置く。
- 正規表現でソースを grep する方式は引用符やクォート種別・`import type` を取りこぼす。lint は AST を見るので漏れない。
- エディタに即座に赤線が出る。

実装メモ: flat config で同じ `no-restricted-imports` キーのブロックを重ねると**マージではなく上書き**になる。
そのため base で両パッケージを禁止し、窓口ファイルごとに override（自分が担当するパッケージだけ許可）を置いている。
`import type` も意図的に禁止（型も Icon.tsx 経由に集約済み。`src/constants/icons.ts` 参照）。

新しく「このモジュール経由でのみ使う」窓口を作ったら、テストを書くのではなくここに 1 エントリ足すのが正着。

## 純粋関数のテスト基盤は既にある（Issue #38 の前提は古い）

Issue [#38](https://github.com/kmch4n/SnowLog/issues/38) は「テスト基盤が無いので Vitest / Jest を導入する」と提案しているが、
**`versionUtils.test.cjs` が確立した「tsc でコンパイルして require する」パターンがそのまま使える**。
新しいランナーの導入も、Expo / RN との設定調整も要らない。

2026-07-16 に #38 の 4 関数のうち 3 つを追加済み（`parseTechniques` / `calendarUtils` / `dateUtils`）。
残りは `geoUtils` のみ（下記）。#38 は部分対応でオープンのまま。

### コンパイル可否は「import の形」で決まる（重要）

このパターンが素で通るかは、対象ファイルの import 形態で 4 段階に分かれる。**実測済み。**

| import 形態 | 例 | 素の `tsc <file>` | require 先 |
| --- | --- | --- | --- |
| import なし | `parseTechniques.ts` | 通る | `out/parseTechniques.js`（平坦） |
| **相対**の型 import | `dateUtils.ts`（`../types/dashboard`） | 通る | `out/utils/dateUtils.js`（**ネスト**） |
| **エイリアス**の型 import | `calendarUtils.ts`（`@/types`） | **TS2307 で失敗** | 一時 tsconfig が必要 |
| エイリアスの**値** import | `geoUtils.ts`（`@/constants/skiResorts.json`） | **失敗** | tsconfig + ランタイムフックが必要 |

- 型 import でも**エイリアスなら素の tsc は解決できない**（`paths` が無いため）。`import type` だから安全、ではない。
- 相対 import があると rootDir が `src/` に繰り上がり、emit が `out/utils/*.js` に**ネスト**する。
  require パスを間違えやすい（既存の `videoListEquality.test.cjs` も `outDir/utils/...` を見ている）。
- 一時 tsconfig を書く場合、**実 `tsconfig.json` を `extends` してはいけない**。
  `expo/tsconfig.base` 由来の `moduleResolution: "bundler"` が `module: "commonjs"` と衝突し TS5095 で落ちる。
  `baseUrl` + `@/*` paths だけを書いた**自己完結**の tsconfig にする。パスは**絶対**にすること
  （相対は tsconfig の置き場所基準で解決され、repo を指さない）。実例は `calendarUtils.test.cjs`。

### 日付系は TZ を固定する

この開発機のローカルは Asia/Tokyo。**TZ を固定しないと現地では緑になり、UTC 環境で初めて割れる**——最悪の見落とし方。
`calendarUtils.test.cjs` / `dateUtils.test.cjs` は先頭（最初の `Date` 生成より前）で
`process.env.TZ = "Asia/Tokyo"` を設定している。Node は同一プロセス内の再代入を以後の `Date` に反映する（実測）。
新しく日付系テストを足すときは、必ず `TZ=UTC node --test ...` でも緑になることを確認すること。

`Intl` を使う関数（`formatDate` / `formatDateShort` / `formatDateTime`）は、TZ を固定しても
**ICU のバージョンで書式が揺れる**。厳密なグリフ比較はせず、ロケール分岐と値の存在だけを見る。

### geoUtils が残っている理由

`geoUtils.ts` は `@/constants/skiResorts.json` を**エイリアス経由で値 import** するため、上表の最難関。
仮に一時 tsconfig で型解決しても、**tsc は emit 時に specifier を書き換えない**ので出力に
`require("@/constants/skiResorts.json")` が残り、Node が実行時に解決できない（実測）。取りうる案は 2 つ:

- (A) テスト内治具: 自己完結 tsconfig + `Module._load` フックで `@/` を実ファイルへ橋渡し。ソース非改変だが約 20〜30 行の別種の治具
- (B) `haversineKm` を無依存モジュールに抽出 + `findNearbySkiResorts` に resort 配列を引数注入。ソース改修。
  GPS サジェスト経路（`useSkiResortSuggestions`）に実呼び出しがあり再検証が要る

`haversineKm` は純数学で高価値（同一点 = ちょうど 0、対称性がビット完全一致——実測）。
`findNearbySkiResorts` はモジュール定数 378 件依存で注入不可のため、(A) では不変条件
（≤maxResults / 昇順 / threshold 内 / 遠方で空）しか検証できず、**sort→slice の順序改悪は検出できない**。

## 主要な検証手段は依然として手動

自動テストは補助的で、iOS 実機/シミュレータでの手動確認が主。
スキーマ・インポート・エクスポート・ダッシュボードに触ったら、`migrate → import → search → export` の全フローを通す。
`*.web.tsx` に触ったときだけ Web も確認する。
PR 前には `npm run lint` も実行する。
