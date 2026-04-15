import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

const expo = openDatabaseSync("snowlog.db", { enableChangeListener: true });
expo.execSync("PRAGMA foreign_keys = ON");
expo.execSync("PRAGMA journal_mode = WAL");

/**
 * Drizzle ORM インスタンス
 * アプリ全体でシングルトンとして使用する
 */
export const db = drizzle(expo, { schema });

export * from "./schema";
