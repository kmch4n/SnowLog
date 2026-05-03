const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const homePath = path.join(rootDir, "src", "app", "(tabs)", "index", "index.tsx");
const compactCardPath = path.join(rootDir, "src", "components", "VideoCardCompact.tsx");
const jaLocalePath = path.join(rootDir, "src", "i18n", "locales", "ja.ts");
const enLocalePath = path.join(rootDir, "src", "i18n", "locales", "en.ts");

test("home video cards expose a trailing swipe delete action", () => {
    const homeSource = readFileSync(homePath, "utf8");
    const cardSource = readFileSync(compactCardPath, "utf8");

    assert.match(cardSource, /ReanimatedSwipeable/);
    assert.match(cardSource, /renderRightActions=\{renderRightActions\}/);
    assert.match(cardSource, /enabled=\{Boolean\(onSwipeDelete\) && !isSelectionMode && !isSwipeDeleteDisabled\}/);
    assert.match(cardSource, /t\("common\.delete"\)/);
    assert.match(homeSource, /onSwipeDelete=\{\(\) => handleSwipeDelete\(item\)\}/);
    assert.match(homeSource, /isSwipeDeleteDisabled=\{isBulkProcessing \|\| deletingVideoId !== null\}/);
});

test("home swipe delete action uses an iOS-style icon and compact system red surface", () => {
    const cardSource = readFileSync(compactCardPath, "utf8");

    assert.match(cardSource, /import \{ SymbolView \} from "expo-symbols"/);
    assert.match(cardSource, /name="trash"/);
    assert.match(cardSource, /tintColor=\{Colors\.headerText\}/);
    assert.match(cardSource, /IOS_DESTRUCTIVE_RED/);
    assert.match(cardSource, /width: 80/);
    assert.match(cardSource, /flexDirection: "column"/);
    assert.match(cardSource, /fontWeight: "600"/);
});

test("home swipe delete confirms before using the cleanup deletion path", () => {
    const homeSource = readFileSync(homePath, "utf8");

    assert.match(homeSource, /const handleSwipeDelete = useCallback/);
    assert.match(homeSource, /Alert\.alert\(\s*t\("home\.swipeDelete\.title"\)/);
    assert.match(homeSource, /t\("home\.swipeDelete\.body"/);
    assert.match(homeSource, /await deleteVideosWithCleanup\(\[video\.id\]\)/);
    assert.match(homeSource, /refreshAll\(\)/);
    assert.match(homeSource, /refreshFav\(\)/);
});

test("home swipe delete strings are localized", () => {
    const jaSource = readFileSync(jaLocalePath, "utf8");
    const enSource = readFileSync(enLocalePath, "utf8");

    assert.match(jaSource, /swipeDelete:/);
    assert.match(jaSource, /title: "動画を削除"/);
    assert.match(jaSource, /deleteFailedTitle: "削除に失敗しました"/);
    assert.match(enSource, /swipeDelete:/);
    assert.match(enSource, /title: "Delete video"/);
    assert.match(enSource, /deleteFailedTitle: "Delete failed"/);
});
