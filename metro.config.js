const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// drizzle-orm のマイグレーション SQL ファイルを認識させるために必要
config.resolver.sourceExts.push("sql");

// Web ビルド時に expo-sqlite / drizzle-orm/expo-sqlite を空モジュールとして解決する
// _layout.tsx が require.context で一緒にバンドルされても wa-sqlite.wasm エラーを回避するため
const emptyModule = path.resolve(__dirname, "src/mocks/emptyModule.js");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === "web") {
        if (
            moduleName === "expo-sqlite" ||
            moduleName.startsWith("drizzle-orm/expo-sqlite")
        ) {
            return { type: "sourceFile", filePath: emptyModule };
        }
    }
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
