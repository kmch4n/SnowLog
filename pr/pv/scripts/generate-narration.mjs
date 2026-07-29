// Synthesises one narration WAV per scene from the text in src/script.ts using
// a local Irodori-TTS server, then normalises every file to a consistent
// loudness.
//
//   node scripts/generate-narration.mjs [seed]
//
// The server must already be running and listening on IRODORI_HOST
// (default http://127.0.0.1:8088). See pr/pv/public/README.md.
//
// Irodori-TTS is MIT licensed, so unlike the voice libraries this replaced
// there is no credit line to carry in the film.
//
// Voice consistency is handled structurally rather than by trusting a seed:
// the first run synthesises one reference line, registers it as a voice, and
// clones every subsequent line from it. A no-reference model is otherwise free
// to pick a different speaker per request, and nine scenes would arrive in
// nine voices.
//
// Swapping engines later means replacing the WAVs and nothing else:
// calculateMetadata re-reads their real lengths and re-times every scene.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/script.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "audio", "narration");
const TEMP_DIR = join(HERE, "..", "out", "narration-tmp");

const HOST = process.env.IRODORI_HOST ?? "http://127.0.0.1:8088";
const MODEL = "irodori-tts";
const VOICE_ID = "snowlog-narrator";

/** Only used to mint the reference clip, and only on the very first run. */
const REFERENCE_TEXT = "滑走動画を、練習の記録として残していきましょう。";

/**
 * The voice, described rather than drawn from a seed lottery. The VoiceDesign
 * checkpoint conditions on this: gender, age, tone, pace and setting are all
 * fair game. Only the reference clip needs it — every line after that is cloned
 * from the clip, which is what keeps the speaker identical across scenes.
 */
const VOICE_CAPTION =
    "落ち着いた若い男性の声。アプリの紹介ナレーションとして、聞き取りやすくはっきりと、" +
    "少し明るめのトーンで丁寧に話している。";

/** YouTube's reference level. -16 still read as quiet against the footage. */
const TARGET_LUFS = -14;
const TRUE_PEAK_DB = -1.5;

const speak = async (text, { voice, seed, caption }) => {
    const response = await fetch(`${HOST}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
            model: MODEL,
            input: text,
            voice,
            response_format: "wav",
            ...(seed === undefined ? {} : { seed }),
            ...(caption === undefined ? {} : { caption }),
        }),
    });

    if (!response.ok) {
        throw new Error(`speech failed (${response.status}): ${await response.text()}`);
    }

    return Buffer.from(await response.arrayBuffer());
};

const voiceExists = async () => {
    const response = await fetch(`${HOST}/v1/audio/voices`);
    const { data } = await response.json();
    return data.some((voice) => voice.id === VOICE_ID);
};

const registerNarratorVoice = async (seed) => {
    const referencePath = join(TEMP_DIR, `${VOICE_ID}.wav`);
    writeFileSync(
        referencePath,
        await speak(REFERENCE_TEXT, { voice: "none", seed, caption: VOICE_CAPTION }),
    );

    const form = new FormData();
    form.append("file", new Blob([readFileSync(referencePath)]), `${VOICE_ID}.wav`);
    form.append("voice_id", VOICE_ID);

    const response = await fetch(`${HOST}/v1/audio/voices`, { method: "POST", body: form });

    if (!response.ok) {
        throw new Error(`voice upload failed (${response.status}): ${await response.text()}`);
    }

    console.log(`registered reference voice "${VOICE_ID}" from seed ${seed}`);
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
    const seed = Number(process.argv[2] ?? 20260730);

    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(TEMP_DIR, { recursive: true });

    if (await voiceExists()) {
        console.log(`reusing existing reference voice "${VOICE_ID}"`);
    } else {
        await registerNarratorVoice(seed);
    }

    for (const scene of SCENES) {
        // The title card carries no spoken line.
        if (scene.narrationText === "") {
            continue;
        }

        const outPath = join(OUT_DIR, `${scene.id}.wav`);
        writeFileSync(outPath, await speak(scene.narrationText, { voice: VOICE_ID }));
        normalise(outPath);
        console.log(`wrote ${scene.id}`);
    }

    const written = readdirSync(OUT_DIR).filter((name) => name.endsWith(".wav"));
    console.log(
        `\nGenerated ${written.length} narration files with Irodori-TTS, ` +
            `normalised to ${TARGET_LUFS} LUFS.`,
    );
};

main().catch((error) => {
    console.error(String(error));
    console.error(
        `\nIs the Irodori-TTS server running at ${HOST}? See pr/pv/public/README.md.`,
    );
    process.exit(1);
});
