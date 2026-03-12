import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    // Expo SQLite 向けドライバー
    driver: "expo",
    schema: "./src/database/schema.ts",
    out: "./drizzle",
});
