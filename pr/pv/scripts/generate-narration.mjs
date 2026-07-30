// Synthesises one narration WAV per scene from the text in src/script.ts using
// a local Irodori-TTS server, then normalises every file to a consistent
// loudness.
//
//   node scripts/generate-narration.mjs
//
// The server must already be running and listening on IRODORI_HOST
// (default http://127.0.0.1:8088). See pr/pv/public/README.md.
//
// Irodori-TTS is MIT licensed, so unlike the voice libraries this replaced
// there is no credit line to carry in the film.
//
// ## Why there is a reference clip
//
// Generation is byte-deterministic: the same text, caption, seed and step count
// return a byte-identical WAV, verified by hashing repeated requests. So one
// line is reproducible. Nine lines are not, because the caption fixes what kind
// of voice appears and not which one -- across four lines at a fixed seed the
// measured pitch ranged from 115 Hz to 167 Hz. Two different men.
//
// A speaker reference is the only parameter that pins identity. An earlier
// attempt instead over-generated each line and kept the take whose median pitch
// was closest to a target. That optimised the wrong quantity: it drove pitch
// spread down to 11.5 Hz while the spectral envelope -- where identity actually
// lives -- stayed 6.25 dB apart, so the numbers improved and the files still
// sounded like different people. Cloning from a fixed reference cuts that
// envelope spread by roughly half over the same lines.
//
// What survives cloning is a roughly 30 Hz spread of median pitch between lines,
// and that is prosody rather than drift: the same lines are the outliers at every
// reference strength, and F0 already sweeps 62 Hz *inside* a single sentence, so
// the sentences overlap each other almost entirely. The old 11.5 Hz figure was
// not a better voice, only a number that had been selected for.
//
// ## Why the reference is chosen rather than just taken
//
// The reference also sets a noise floor that every cloned line inherits, and the
// model does not produce equally clean clips. Eight candidates from identical
// settings, differing only in seed, measured between -31.5 dB and -56.4 dB of
// energy above 8 kHz. The first reference used here was taken without measuring,
// landed at -32.7 dB, and the narration built on it was audibly gritty: cloning
// had copied its noise into all nine lines. Dose and response -- a longer
// composite reference was noisier still and produced the noisiest lines of all.
//
// So candidates are generated and scored by scripts/pick-reference.py, and the
// winner is brought to the loudness the server expects before being uploaded.
// Finished lines then measure past -54 dB, cleaner than caption-only generation
// with no reference at all.
//
// Check the result with scripts/check-narration-voice.py, which reports the
// envelope spread and the noise rather than the pitch spread.
//
// Because generation is deterministic the reference is synthesised from the
// constants below rather than stored as a binary asset, so this file is the
// whole specification of the voice.
//
// Swapping engines later means replacing the WAVs and nothing else:
// calculateMetadata re-reads their real lengths and re-times every scene.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/script.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "audio", "narration");
const WORK_DIR = join(HERE, "..", "out", "narration");
const REFERENCE_PATH = join(WORK_DIR, "reference.wav");
const SETTINGS_PATH = join(WORK_DIR, "settings.json");

const HOST = process.env.IRODORI_HOST ?? "http://127.0.0.1:8088";
const MODEL = "irodori-tts";
const VOICE_ID = "snowlog-narrator";

/**
 * The voice, described rather than drawn from a seed lottery. The VoiceDesign
 * checkpoint conditions on this: gender, age, tone, pace and setting are all
 * fair game.
 *
 * Deliberately does not ask for a bright tone. The first attempt did, and a
 * bright young male voice came out light and airy -- the "hollow" quality that
 * sent this back. Asking for body instead pulls the other way.
 */
const VOICE_CAPTION =
    "20代半ばの男性のナレーター。落ち着いた芯のある声で、少しゆっくりと、" +
    "はっきり丁寧に説明している。";

/**
 * The line the reference clip speaks. About 7.5 seconds of audio.
 *
 * Resist the urge to lengthen this. A longer reference sounds like it should
 * lock identity harder, so it was tried: three sentences chosen for phonetic
 * breadth, 18.3 seconds. It measured *worse* on every count -- envelope spread
 * 4.47 dB against 4.11, pitch spread 17.0 Hz against 11.2. One clean delivery
 * is a sharper target than a composite of several.
 *
 * A near-miss of the real script on purpose: reusing an actual line would make
 * the reference and that scene's output near-duplicates.
 */
const REFERENCE_TEXT =
    "滑走動画を練習の記録として残していくアプリです。落ち着いて、はっきりお伝えします。";

/**
 * How many candidate references to generate and score. Eight covers the range
 * well: of eight tried, two came in under -50 dB of noise and six did not, so a
 * much smaller pool risks not finding a clean one at all.
 */
const REFERENCE_CANDIDATES = 8;

/**
 * The server's own guideline for quality, and where this measured best.
 *
 * 64 was used for a while on the theory that more steps meant more stability.
 * Measured against 40 on the same lines it was slightly worse on both noise
 * (-61.32 dB against -61.95) and roughness (2.44 dB against 2.52), while taking
 * 1.6x as long. The upstream guide puts the useful band at 32-40 and calls 40
 * the figure for quality work.
 */
const NUM_STEPS = 40;

/**
 * How closely the reference is followed. The server's default, stated
 * explicitly so a change upstream cannot quietly change this film's voice.
 *
 * 3.0 was tried on the theory that a looser grip would pick up less of the
 * reference's own thinness. Measured over all nine lines it did the opposite:
 * 3.0 was both the least consistent (envelope spread 3.84 dB against 3.77) and
 * the thinnest (low-mid body bottoming out at +20.87 dB against +21.68). 7.0
 * measures better still on both, but that is past the tuned default and into
 * the range where guidance scales start to distort, which is not a trade worth
 * making for 0.27 dB.
 */
const CFG_SCALE_SPEAKER = 5;

const SEED = 20260730;

/** YouTube's reference level. -16 still read as quiet against the footage. */
const TARGET_LUFS = -14;
const TRUE_PEAK_DB = -1.5;

/**
 * What the reference itself is brought to before upload.
 *
 * The server normalises the reference to -16 LUFS by default, and notes that
 * this matches how the codec was trained. The first reference here was written
 * out raw: -17.82 LUFS with a true peak of -0.04 dBTP, so the server's own step
 * had to add 1.8 dB to a signal already at the ceiling. Doing it here, with the
 * peak held well down, leaves that step nothing to do and nothing to clip.
 */
const REFERENCE_LUFS = -16;
const REFERENCE_PEAK_DB = -3;

const RETRIES = 3;

/**
 * Everything that decides how the audio comes out. Stored beside the output so
 * a changed setting regenerates every file instead of leaving a mix of old and
 * new -- which is how nine files ended up with nine voices.
 *
 * Split in two because the reference does not depend on every setting: tuning
 * how hard it is followed should not throw away the reference itself.
 */
const referenceSettings = () => ({
    caption: VOICE_CAPTION,
    referenceText: REFERENCE_TEXT,
    referenceCandidates: REFERENCE_CANDIDATES,
    referenceLufs: REFERENCE_LUFS,
    referencePeakDb: REFERENCE_PEAK_DB,
    numSteps: NUM_STEPS,
    seed: SEED,
});

const settings = () => ({
    ...referenceSettings(),
    cfgScaleSpeaker: CFG_SCALE_SPEAKER,
    lines: SCENES.map((scene) => `${scene.id}:${scene.narrationText}`),
});

const digest = (value) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const speak = async (text, voice, options, attempt = 1) => {
    let response;

    try {
        response = await fetch(`${HOST}/v1/audio/speech`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
                model: MODEL,
                input: text,
                voice,
                response_format: "wav",
                // These belong inside `irodori`, per the server's schema. It
                // happens to accept them at the top level too, but only the
                // documented shape is guaranteed.
                irodori: { caption: VOICE_CAPTION, num_steps: NUM_STEPS, seed: SEED, ...options },
            }),
        });
    } catch (error) {
        if (attempt >= RETRIES) {
            throw error;
        }
        console.log(`  retrying (${attempt}/${RETRIES}): ${error}`);
        return speak(text, voice, options, attempt + 1);
    }

    if (!response.ok) {
        throw new Error(`speech failed (${response.status}): ${await response.text()}`);
    }

    return Buffer.from(await response.arrayBuffer());
};

const ffmpeg = (args, what) => {
    const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

    if (result.status !== 0) {
        throw new Error(`ffmpeg failed: ${what}`);
    }
};

/**
 * First loudnorm pass: what is this file's loudness, before changing it?
 *
 * Needed because a single pass corrects *while* it listens, so its gain moves
 * over the file and lands somewhere near the target rather than on it. Nine
 * files each drifting their own way is the same class of inconsistency this
 * whole script is fighting, and on a 3.4 second line there is barely enough
 * audio for the correction to settle at all.
 */
const measureLoudness = (path, target) => {
    const result = spawnSync(
        "ffmpeg",
        ["-hide_banner", "-i", path, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"],
        { encoding: "utf8" },
    );

    // The report goes to stderr, after everything else ffmpeg has to say.
    const start = result.stderr.lastIndexOf("{");
    const end = result.stderr.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error(`could not measure loudness of ${path}:\n${result.stderr}`);
    }

    return JSON.parse(result.stderr.slice(start, end + 1));
};

/** Second loudnorm pass, as one fixed gain rather than a moving one. */
const applyLoudness = (source, target, level, extra = []) => {
    const measured = measureLoudness(source, level);
    const applied = [
        level,
        `measured_I=${measured.input_i}`,
        `measured_TP=${measured.input_tp}`,
        `measured_LRA=${measured.input_lra}`,
        `measured_thresh=${measured.input_thresh}`,
        `offset=${measured.target_offset}`,
        // One gain figure for the whole file. Without this the second pass would
        // compress as it goes, which changes the tone of a voice and not just its
        // level -- and differently in each file.
        "linear=true",
    ].join(":");

    ffmpeg(
        ["-i", source, "-af", `loudnorm=${applied}`, "-ar", "48000", "-ac", "1", ...extra, target],
        `normalising ${source}`,
    );
};

/**
 * Generates several candidate references, keeps the best, and brings it to the
 * loudness the server expects.
 *
 * Written as 32-bit float. The conditioning step lowers the level, and at 16 bits
 * that showed up as a rising noise floor -- the same clip measured 3 dB hissier
 * after a gain change that mathematically cannot alter the ratio. Float has no
 * such floor.
 */
const buildReference = async () => {
    const candidates = [];

    console.log(`generating ${REFERENCE_CANDIDATES} candidate references`);
    for (let index = 0; index < REFERENCE_CANDIDATES; index++) {
        const path = join(WORK_DIR, `candidate-${index}.wav`);
        writeFileSync(path, await speak(REFERENCE_TEXT, "none", { seed: SEED + index }));
        candidates.push(path);
    }

    const chosen = spawnSync("python", [join(HERE, "pick-reference.py"), ...candidates], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
    });

    if (chosen.status !== 0) {
        throw new Error("reference selection failed");
    }

    const index = Number(chosen.stdout.trim());

    if (!Number.isInteger(index) || candidates[index] === undefined) {
        throw new Error(`reference selection returned "${chosen.stdout.trim()}"`);
    }

    applyLoudness(
        candidates[index],
        REFERENCE_PATH,
        `I=${REFERENCE_LUFS}:TP=${REFERENCE_PEAK_DB}:LRA=11`,
        ["-c:a", "pcm_f32le"],
    );

    for (const path of candidates) {
        rmSync(path, { force: true });
    }
};

/** Uploads the reference so later requests can name it, replacing any previous one. */
const registerVoice = async () => {
    const listed = await fetch(`${HOST}/v1/audio/voices`);
    const known = (await listed.json()).data.some((voice) => voice.id === VOICE_ID);

    const form = new FormData();
    form.append("file", new Blob([readFileSync(REFERENCE_PATH)], { type: "audio/wav" }), `${VOICE_ID}.wav`);

    let response;
    if (known) {
        response = await fetch(`${HOST}/v1/audio/voices/${VOICE_ID}`, { method: "PUT", body: form });
    } else {
        form.append("voice_id", VOICE_ID);
        response = await fetch(`${HOST}/v1/audio/voices`, { method: "POST", body: form });
    }

    if (!response.ok) {
        throw new Error(`voice upload failed (${response.status}): ${await response.text()}`);
    }
};

/**
 * Brings every line to the same perceived loudness. Synthesised speech varies
 * line to line, and the raw output is quieter than a viewer expects from a
 * video.
 *
 * Stays at 48 kHz: the model emits 48 kHz and an earlier version of this step
 * resampled to 44.1, which ffmpeg warned would lose high frequencies. Throwing
 * away the top of a voice is exactly how it ends up sounding thin.
 */
const normalise = (path) => {
    const temp = `${path}.norm.wav`;
    applyLoudness(path, temp, `I=${TARGET_LUFS}:TP=${TRUE_PEAK_DB}:LRA=11`);
    renameSync(temp, path);
};

const main = async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(WORK_DIR, { recursive: true });

    const current = digest(settings());
    const currentReference = digest(referenceSettings());
    const previous = existsSync(SETTINGS_PATH) ? JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) : {};
    const unchanged = previous.fingerprint === current;

    if (!unchanged) {
        console.log(
            previous.fingerprint === undefined
                ? "no previous run recorded"
                : `settings changed (${previous.fingerprint} -> ${current})`,
        );
        console.log("regenerating every line, so the whole film speaks with one voice\n");
    }

    if (previous.referenceFingerprint !== currentReference || !existsSync(REFERENCE_PATH)) {
        console.log("building the reference clip");
        await buildReference();
    }

    console.log(`registering it as "${VOICE_ID}"\n`);
    await registerVoice();

    for (const scene of SCENES) {
        // The title card carries no spoken line.
        if (scene.narrationText === "") {
            continue;
        }

        const outPath = join(OUT_DIR, `${scene.id}.wav`);

        if (unchanged && existsSync(outPath)) {
            console.log(`${scene.id}: already present, skipped`);
            continue;
        }

        writeFileSync(outPath, await speak(scene.narrationText, VOICE_ID, { cfg_scale_speaker: CFG_SCALE_SPEAKER }));
        normalise(outPath);
        console.log(`${scene.id}: done`);
    }

    writeFileSync(
        SETTINGS_PATH,
        `${JSON.stringify({ fingerprint: current, referenceFingerprint: currentReference, ...settings() }, null, 4)}\n`,
    );

    const written = readdirSync(OUT_DIR).filter((name) => name.endsWith(".wav"));
    console.log(
        `\nGenerated ${written.length} narration files with Irodori-TTS, ` +
            `normalised to ${TARGET_LUFS} LUFS, all cloned from one reference.`,
    );
    console.log(
        "Check they are one voice:\n" +
            `  python scripts/check-narration-voice.py ${OUT_DIR.replace(/\\/g, "/")}/*.wav`,
    );
};

main().catch((error) => {
    console.error(String(error));
    console.error(
        `\nIs the Irodori-TTS server running at ${HOST}? See pr/pv/public/README.md.`,
    );
    process.exit(1);
});
