"use strict";

/**
 * Patch @expo/image-utils so its cache lives under os.tmpdir() instead of
 * the project-local `.expo/web` directory that is read-only on EAS builders.
 */

const fs = require("fs");
const path = require("path");

const cacheFile = path.join(
    __dirname,
    "..",
    "node_modules",
    "@expo",
    "image-utils",
    "build",
    "Cache.js"
);

const originalConst = "const CACHE_LOCATION = '.expo/web/cache/production/images';";
const patchedConst = "const CACHE_LOCATION = require('os').tmpdir() + '/expo-image-cache';";
const joinSearch = "(0, path_1.join)(projectRoot, CACHE_LOCATION,";
const joinPattern = /\(0, path_1\.join\)\(projectRoot, CACHE_LOCATION,/g;
const patchedJoin = "(0, path_1.join)(CACHE_LOCATION,";

function exitWithMessage(message, isError = false) {
    const writer = isError ? console.error : console.log;
    writer(message);
    process.exit(isError ? 1 : 0);
}

if (!fs.existsSync(cacheFile)) {
    exitWithMessage(
        `[patch] Cache.js was not found at ${cacheFile}. Was \`npm install\` run?`,
        true
    );
}

let content = fs.readFileSync(cacheFile, "utf8");

if (content.includes(patchedConst)) {
    exitWithMessage("[patch] Cache.js already uses os.tmpdir(); skipping");
}

if (!content.includes(originalConst)) {
    exitWithMessage("[patch] Cache.js structure unexpected; cannot patch", true);
}

content = content.replace(originalConst, patchedConst);

if (!content.includes(joinSearch)) {
    exitWithMessage("[patch] Could not find projectRoot join call to update", true);
}

content = content.replace(joinPattern, patchedJoin);
fs.writeFileSync(cacheFile, content, "utf8");
exitWithMessage("[patch] Redirected @expo/image-utils cache to os.tmpdir()");
