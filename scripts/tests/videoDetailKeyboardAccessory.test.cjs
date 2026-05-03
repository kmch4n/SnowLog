const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const videoDetailPath = path.join(rootDir, "src", "app", "video", "[id].tsx");
const jaLocalePath = path.join(rootDir, "src", "i18n", "locales", "ja.ts");
const enLocalePath = path.join(rootDir, "src", "i18n", "locales", "en.ts");

test("video detail memo input exposes an iOS keyboard done accessory", () => {
    const source = readFileSync(videoDetailPath, "utf8");

    assert.match(source, /InputAccessoryView/);
    assert.match(source, /Keyboard\.dismiss\(\)/);
    assert.match(source, /MEMO_INPUT_ACCESSORY_ID/);
    assert.match(source, /inputAccessoryViewID=\{Platform\.OS === "ios" \? MEMO_INPUT_ACCESSORY_ID : undefined\}/);
    assert.match(source, /nativeID=\{MEMO_INPUT_ACCESSORY_ID\}/);
    assert.match(source, /t\("common\.done"\)/);
});

test("video detail scrolls the bottom memo input above the keyboard", () => {
    const source = readFileSync(videoDetailPath, "utf8");

    assert.match(source, /scrollViewRef/);
    assert.match(source, /Keyboard\.addListener/);
    assert.match(source, /keyboardWillShow/);
    assert.match(source, /keyboardDidShow/);
    assert.match(source, /scrollToEnd\(\{ animated: true \}\)/);
    assert.match(source, /onFocus=\{handleMemoFocus\}/);
    assert.match(source, /onBlur=\{handleMemoBlur\}/);
    assert.match(source, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === "ios"\}/);
});

test("keyboard done label is localized", () => {
    const jaSource = readFileSync(jaLocalePath, "utf8");
    const enSource = readFileSync(enLocalePath, "utf8");

    assert.match(jaSource, /done: "完了"/);
    assert.match(enSource, /done: "Done"/);
});
