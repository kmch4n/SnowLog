// English counts went through "{{count}} videos" whatever the count, so the app said
// "1 videos" (calendar, dashboard, duplicates, GPS confirmation, and the VoiceOver
// labels). Those keys are now i18n-js plural branches ({ one, other }); Japanese has
// no plural, so its two forms are the same string.
//
// This runs the real ja.ts / en.ts through the real i18n-js, the same way
// src/i18n/index.ts configures it, so it checks the data and the library together.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { I18n } = require("i18n-js");

const localesDir = path.resolve(__dirname, "..", "..", "src", "i18n", "locales");

function loadLocale(name) {
    const file = path.join(localesDir, `${name}.ts`);
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const module = { exports: {} };
    new Function("module", "exports", "require", outputText)(module, module.exports, () => ({}));
    return module.exports[name];
}

const ja = loadLocale("ja");
const en = loadLocale("en");
const i18n = new I18n({ ja, en });
i18n.enableFallback = true;
i18n.defaultLocale = "ja";

function tIn(locale, key, params) {
    i18n.locale = locale;
    return i18n.t(key, params);
}

function pluralBranches(value, prefix = "", out = []) {
    if (value === null || typeof value !== "object") return out;
    const keys = Object.keys(value);
    if (prefix && keys.includes("other") && keys.every((k) => ["zero", "one", "other"].includes(k))) {
        out.push(prefix);
        return out;
    }
    for (const [key, child] of Object.entries(value)) {
        pluralBranches(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
}

const branches = pluralBranches(en);

test("the plural keys are found", () => {
    assert.ok(branches.length >= 14, `only ${branches.length} plural branches`);
    assert.deepEqual(pluralBranches(ja).sort(), [...branches].sort(), "ja and en differ");
});

test("English uses the singular form for one and the plural form otherwise", () => {
    assert.equal(tIn("en", "calendar.videoCount", { count: 1 }), "1 video");
    assert.equal(tIn("en", "calendar.videoCount", { count: 2 }), "2 videos");
    assert.equal(tIn("en", "calendar.videoCount", { count: 0 }), "0 videos");
    assert.equal(tIn("en", "search.resultCount", { count: 1 }), "1 result");
    assert.equal(
        tIn("en", "import.gpsConfirm.distanceLabel", { count: 1, distance: "2.5" }),
        "1 video · 2.5km"
    );
});

test("every English singular form differs from its plural and reads as singular", () => {
    for (const key of branches) {
        const one = tIn("en", key, { count: 1, distance: "1.0", resortName: "X" });
        const other = tIn("en", key, { count: 2, distance: "1.0", resortName: "X" });
        assert.notEqual(one, other, key);
        assert.doesNotMatch(one, /\b1 (videos|results|files|records|groups)\b|\(s\)/, key);
        assert.doesNotMatch(other, /\(s\)/, key);
    }
});

test("Japanese renders the same text for one and many", () => {
    for (const key of branches) {
        const params = { distance: "1.0", resortName: "X" };
        const one = tIn("ja", key, { ...params, count: 1 });
        const many = tIn("ja", key, { ...params, count: 3 });
        assert.equal(one.replace("1", "#"), many.replace("3", "#"), key);
        assert.doesNotMatch(one, /\[missing/, key);
    }
    assert.equal(tIn("ja", "calendar.videoCount", { count: 1 }), "1本");
});
