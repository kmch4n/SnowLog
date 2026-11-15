// The native module and the JS side share a few names and values by hand (#86 §4.2).
// Swift cannot be compiled here, so this reads both sources and fails when they drift:
// a failure code the JS side switches on that native never sends, a path field the
// JS policy reads that native never fills, or two different free-space reserves.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const swiftCore = "modules/snowlog-media/ios/Core/Sources";

function tsUnionMembers(source, typeName) {
    const match = new RegExp(`export type ${typeName} =([^;]+);`).exec(source);
    assert.ok(match, `type ${typeName} not found`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function tsInterfaceFields(source, interfaceName) {
    const match = new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`).exec(source);
    assert.ok(match, `interface ${interfaceName} not found`);
    return [...match[1].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}

test("Swift MediaFailureCode raw values are the JS MediaFailureCode strings, in order", () => {
    const swift = read(`${swiftCore}/MediaFailureCode.swift`);
    const swiftValues = [...swift.matchAll(/case \w+ = "([^"]+)"/g)].map((m) => m[1]);
    const jsValues = tsUnionMembers(read("src/types/media.ts"), "MediaFailureCode");
    assert.ok(jsValues.length >= 10, "parser found the JS union");
    assert.deepEqual(swiftValues, jsValues);
});

test("Swift NetworkPathState has the fields the JS policy reads", () => {
    const swift = read(`${swiftCore}/NetworkPathState.swift`);
    const swiftFields = [...swift.matchAll(/public var (\w+): Bool$/gm)].map((m) => m[1]);
    const jsFields = tsInterfaceFields(read("src/utils/mediaPolicy.ts"), "NetworkPathState");
    assert.ok(jsFields.length >= 6, "parser found the JS interface");
    assert.deepEqual(swiftFields, jsFields);
});

test("Swift eligibility checks the same fields in the same order as isEligibleWifiPath", () => {
    const swift = read(`${swiftCore}/NetworkPathState.swift`);
    const swiftBody = /public var isEligibleWifi: Bool \{([\s\S]*?)\n    \}/.exec(swift);
    assert.ok(swiftBody, "isEligibleWifi not found");
    const swiftChecks = [...swiftBody[1].matchAll(/if (!?)(\w+) \{ return false \}/g)].map(
        (m) => `${m[1]}${m[2]}`
    );

    const js = read("src/utils/mediaPolicy.ts");
    const jsBody = /export function isEligibleWifiPath\([^)]*\): boolean \{([\s\S]*?)\n\}/.exec(js);
    assert.ok(jsBody, "isEligibleWifiPath not found");
    const jsChecks = [...jsBody[1].matchAll(/if \((!?)path\.(\w+)\) return false;/g)].map(
        (m) => `${m[1]}${m[2]}`
    );

    assert.equal(jsChecks.length, 6);
    assert.deepEqual(swiftChecks, jsChecks);
});

test("the free-space reserve is the same on both sides", () => {
    const swift = read(`${swiftCore}/PreparationRules.swift`);
    const js = read("src/services/videoTransferRunner.ts");
    assert.match(swift, /static let reserveBytes: Int64 = 256 \* 1024 \* 1024/);
    assert.match(js, /export const FREE_SPACE_RESERVE_BYTES = 256 \* 1024 \* 1024;/);
});

test("the prepared-file extensions are the JS PreparedVideo extensions", () => {
    const swift = read(`${swiftCore}/PreparationRules.swift`);
    const block = /containerTypes: \[String: String\] = \[([\s\S]*?)\]/.exec(swift);
    assert.ok(block, "containerTypes not found");
    const swiftExtensions = [...block[1].matchAll(/"(\w+)": "/g)].map((m) => m[1]).sort();
    const js = read("src/types/media.ts");
    const jsExtensions = /extension: ([^;]+);/.exec(js);
    assert.ok(jsExtensions, "PreparedVideo.extension not found");
    const jsList = [...jsExtensions[1].matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(swiftExtensions, jsList);
});
