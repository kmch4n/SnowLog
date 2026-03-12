module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],
        plugins: [
            // drizzle-orm のマイグレーション SQL ファイルをインライン読み込みするために必要
            ["inline-import", { extensions: [".sql"] }],
            "react-native-reanimated/plugin",
        ],
    };
};
