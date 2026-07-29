// Synthesises one narration WAV per scene from the text in src/script.ts using
// a local VOICEVOX ENGINE, then normalises every file to a consistent loudness.
//
//   node scripts/generate-narration.mjs --list        # show available speakers
//   node scripts/generate-narration.mjs [speakerId]
//
// The engine must already be running and listening on VOICEVOX_HOST
// (default http://127.0.0.1:50021). See pr/pv/public/README.md.
//
// VOICEVOX permits commercial use but requires visible credit, and each voice
// library carries its own terms on top of that — check the speaker you pick.
//
// Swapping engines later means replacing the WAVs and nothing else:
// calculateMetadata re-reads their real lengths and re-times every scene.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/script.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "audio", "narration");
const TEMP_DIR = join(HERE, "..", "out", "narration-tmp");

const HOST = process.env.VOICEVOX_HOST ?? "http://127.0.0.1:50021";

/** YouTube's reference level. -16 still read as quiet against the footage. */
const TARGET_LUFS = -14;
const TRUE_PEAK_DB = -1.5;

const listSpeakers = async () => {
    const speakers = await (await fetch(`${HOST}/speakers`)).json();

    for (const speaker of speakers) {
        for (const style of speaker.styles) {
            console.log(`${String(style.id).padStart(3)}  ${speaker.name} / ${style.name}`);
        }
    }
};

const synthesise = async (text, speaker, outPath) => {
    const queryResponse = await fetch(
        `${HOST}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
        { method: "POST" },
    );

    if (!queryResponse.ok) {
        throw new Error(`audio_query failed: ${queryResponse.status}`);
    }

    const query = await queryResponse.json();
    // A shade slower than default: this is narration over motion, not dialogue.
    query.speedScale = 0.95;
    query.prePhonemeLength = 0.1;
    query.postPhonemeLength = 0.2;

    const audioResponse = await fetch(`${HOST}/synthesis?speaker=${speaker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
    });

    if (!audioResponse.ok) {
        throw new Error(`synthesis failed: ${audioResponse.status}`);
    }

    writeFileSync(outPath, Buffer.from(await audioResponse.arrayBuffer()));
};

/**
 * Brings every line to the same perceived loudness. Synthesised speech varies
 * line to line, and the raw output is quieter than a viewer expects from a
 * video, which is what made the first pass sound thin.
 */
const normalise = (path) => {
    const temp = `${path}.norm.wav`;
    const result = spawnSync(
        "ffmpeg",
        [
            "-y", "-loglevel", "error",
            "-i", path,
            "-af", `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_DB}:LRA=11`,
            "-ar", "44100", "-ac", "1",
            temp,
        ],
        { stdio: "inherit" },
    );

    if (result.status !== 0) {
        throw new Error(`loudnorm failed for ${path}`);
    }

    renameSync(temp, path);
};

const main = async () => {
    if (process.argv[2] === "--list") {
        await listSpeakers();
        return;
    }

    const speaker = Number(process.argv[2] ?? 3);

    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(TEMP_DIR, { recursive: true });

    for (const scene of SCENES) {
        // The title card carries no spoken line.
        if (scene.narrationText === "") {
            continue;
        }

        const outPath = join(OUT_DIR, `${scene.id}.wav`);
        await synthesise(scene.narrationText, speaker, outPath);
        normalise(outPath);
        console.log(`wrote ${scene.id}`);
    }

    rmSync(TEMP_DIR, { recursive: true, force: true });

    const written = readdirSync(OUT_DIR).filter((name) => name.endsWith(".wav"));
    console.log(
        `\nGenerated ${written.length} narration files with speaker ${speaker}, ` +
            `normalised to ${TARGET_LUFS} LUFS.`,
    );
};

main().catch((error) => {
    console.error(String(error));
    console.error(
        `\nIs the VOICEVOX ENGINE running at ${HOST}? ` +
            `Start it, then re-run. See pr/pv/public/README.md.`,
    );
    process.exit(1);
});
