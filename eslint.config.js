// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

const ICON_MESSAGE = 'Import Icon from @/components/ui/Icon instead.';
const HAPTICS_MESSAGE = 'Use the wrappers in @/services/hapticsService instead.';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Keep expo-symbols and expo-haptics behind their single wrappers.
  // Each package may only be imported from the one file that wraps it.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "expo-symbols", message: ICON_MESSAGE },
          { name: "expo-haptics", message: HAPTICS_MESSAGE },
        ],
      }],
    },
  },
  {
    files: ["src/components/ui/Icon.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "expo-haptics", message: HAPTICS_MESSAGE }],
      }],
    },
  },
  {
    files: ["src/services/hapticsService*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "expo-symbols", message: ICON_MESSAGE }],
      }],
    },
  },
]);
