// Synthesises one narration WAV per scene from the text in src/script.ts,
// using the Japanese voices that ship with Windows. No install, no network.
//
//   node scripts/generate-narration.mjs [voice] [rate]
//
// The voice is a licensing decision, not just a taste one: these are Microsoft's
// OS voices, and whether their output may be published commercially has to be
// confirmed before this film ships. Swapping to another engine later means
// replacing the WAVs and nothing else -- calculateMetadata re-reads their real
// lengths and re-times every scene on its own.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/script.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "audio", "narration");
const TEMP_DIR = join(HERE, "..", "out", "narration-tmp");

// Only the "Desktop" voices are registered for the classic SAPI5 interface that
// System.Speech drives; the OneCore ones (Ayumi, Sayaka, ...) enumerate but
// cannot be selected here.
const voice = process.argv[2] ?? "Microsoft Haruka Desktop";
const rate = process.argv[3] ?? "-1";

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

const lines = SCENES.map((scene) => ({
    id: scene.id,
    text: scene.narrationText,
    out: join(OUT_DIR, `${scene.id}.wav`),
}));

const manifest = join(TEMP_DIR, "lines.json");
writeFileSync(manifest, JSON.stringify(lines, null, 4), { encoding: "utf8" });

// Japanese text goes through a UTF-8 file rather than the command line, where
// the console codepage would mangle it. Single-quoted PowerShell strings take
// the path verbatim -- backslashes are not escapes there.
const psQuote = (value) => `'${value.replace(/'/g, "''")}'`;

const script = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$lines = [System.IO.File]::ReadAllText(${psQuote(manifest)}, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice(${psQuote(voice)})
$synth.Rate = ${Number(rate)}
foreach ($line in $lines) {
    $synth.SetOutputToWaveFile($line.out)
    $synth.Speak($line.text)
    Write-Output ("wrote " + $line.id)
}
$synth.Dispose()
`;

const scriptPath = join(TEMP_DIR, "speak.ps1");
// Windows PowerShell 5.1 needs the BOM to read a non-ASCII script correctly,
// and the repository path itself contains Japanese characters.
writeFileSync(scriptPath, "﻿" + script, { encoding: "utf8" });

const result = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { stdio: "inherit" },
);

rmSync(TEMP_DIR, { recursive: true, force: true });

if (result.status !== 0) {
    console.error(`Narration synthesis failed with exit code ${result.status}`);
    process.exit(1);
}

console.log(`\nGenerated ${lines.length} narration files with "${voice}" at rate ${rate}.`);
