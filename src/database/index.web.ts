/**
 * Web 用のデータベース入口
 *
 * Expo Router は描画に使わないレイアウトも評価する（`unstable_settings` を読むため、
 * `_layout.web.tsx` があってもネイティブの `_layout.tsx` を import する）。
 * その import がここに届くので、モジュールの評価時に副作用を起こしてはいけない。
 * Web では `metro.config.js` が `expo-sqlite` を空モジュールに差し替えるため、
 * ネイティブ版のように `openDatabaseSync()` を呼ぶと起動時に落ちる（Issue #84）。
 *
 * 実データは各リポジトリの `.web.ts` スタブが返すので、ここの `db` を使う経路は無い。
 * 誤って使えば `db.select is not a function` で落ちるので、黙って空の結果は返らない。
 */
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export const db = {} as ExpoSQLiteDatabase<typeof schema>;

export * from "./schema";
