"""Reports whether the narration files sound like one person.

    python scripts/check-narration-voice.py public/audio/narration/*.wav

Exists because the obvious measurement is the wrong one. An earlier version of
the generator synthesised each line several times and kept the take whose median
pitch was closest to a target. It worked, by its own metric: pitch spread across
the nine files fell to 11.5 Hz. The files still sounded like different people,
because identity lives in the spectral envelope -- the formants -- and not in
F0. Two takes can both sit at 135 Hz and be two different men. That measurement
reported success while the defect it was supposed to catch was untouched
(timbre spread was 6.25 dB at the time).

So this reports both, and treats the envelope as the one that matters.

Absolute numbers mean little: different sentences contain different phonemes, so
even one speaker reading two texts shows a nonzero distance. Splitting single
files in half and comparing the halves put that floor at about 5 dB mean. Use
these figures to compare two generation settings over the *same* set of lines,
where the phonetic floor is common to both and cancels out.
"""

import os
import sys
import wave

import numpy as np

FRAME_SECONDS = 0.04
HOP_SECONDS = 0.02
SILENCE_RMS = 0.02
MIN_HZ = 70
MAX_HZ = 400

BANDS = 40
BAND_LOW_HZ = 80
BAND_HIGH_HZ = 8000


def read(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path) as handle:
        rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(float) / 32768, rate


def voiced_frames(signal: np.ndarray, rate: int):
    window = int(rate * FRAME_SECONDS)
    hop = int(rate * HOP_SECONDS)
    for start in range(0, max(0, len(signal) - window), hop):
        frame = signal[start : start + window]
        if np.sqrt((frame**2).mean()) >= SILENCE_RMS:
            yield frame


def median_pitch(path: str) -> float:
    signal, rate = read(path)
    window = int(rate * FRAME_SECONDS)
    low, high = int(rate / MAX_HZ), int(rate / MIN_HZ)

    pitches = []
    for frame in voiced_frames(signal, rate):
        frame = frame - frame.mean()
        correlation = np.correlate(frame, frame, "full")[window - 1 :]
        if high >= len(correlation):
            continue
        lag = low + int(np.argmax(correlation[low:high]))
        if lag:
            pitches.append(rate / lag)

    return float(np.median(pitches)) if pitches else 0.0


def mel(hz: np.ndarray) -> np.ndarray:
    return 2595 * np.log10(1 + hz / 700)


def timbre(path: str) -> np.ndarray:
    """Level-normalised log spectral envelope, averaged over voiced frames."""
    signal, rate = read(path)
    window = int(rate * FRAME_SECONDS)
    size = 1 << (window - 1).bit_length()
    hann = np.hanning(window)
    freqs = mel(np.fft.rfftfreq(size, 1 / rate))

    edges = np.linspace(mel(np.array([BAND_LOW_HZ]))[0], mel(np.array([BAND_HIGH_HZ]))[0], BANDS + 1)
    bins = [np.where((freqs >= edges[i]) & (freqs < edges[i + 1]))[0] for i in range(BANDS)]

    total = np.zeros(BANDS)
    count = 0
    for frame in voiced_frames(signal, rate):
        spectrum = np.abs(np.fft.rfft(frame * hann, size)) ** 2
        total += [spectrum[b].mean() if len(b) else 0.0 for b in bins]
        count += 1

    if count == 0:
        raise SystemExit(f"{path}: no voiced audio found")

    envelope = 10 * np.log10(total / count + 1e-12)
    # Remove the overall level so loudness cannot pose as a timbre difference.
    return envelope - envelope.mean()


def body_ratio(path: str) -> float:
    """Low-mid energy against the upper bands. A thin, hollow voice scores low."""
    signal, rate = read(path)
    window = int(rate * FRAME_SECONDS)
    size = 1 << (window - 1).bit_length()
    hann = np.hanning(window)
    freqs = np.fft.rfftfreq(size, 1 / rate)
    low = (freqs >= 120) & (freqs < 600)
    high = (freqs >= 2000) & (freqs < 6000)

    lows, highs = [], []
    for frame in voiced_frames(signal, rate):
        spectrum = np.abs(np.fft.rfft(frame * hann, size)) ** 2
        lows.append(spectrum[low].mean())
        highs.append(spectrum[high].mean())

    return float(10 * np.log10(np.mean(lows) / np.mean(highs)))


def main() -> None:
    paths = sys.argv[1:]

    if len(paths) < 2:
        raise SystemExit("give at least two wav files")

    pitches = [median_pitch(path) for path in paths]
    envelopes = [timbre(path) for path in paths]
    bodies = [body_ratio(path) for path in paths]

    for path, pitch, body in zip(paths, pitches, bodies):
        print(f"  {os.path.basename(path):14s} {pitch:6.1f} Hz   body {body:+5.2f} dB")

    distances = [
        (float(np.sqrt(((envelopes[i] - envelopes[j]) ** 2).mean())), i, j)
        for i in range(len(paths))
        for j in range(i + 1, len(paths))
    ]
    worst, left, right = max(distances)
    values = [d for d, _, _ in distances]

    print()
    print(f"pitch   {min(pitches):.1f} - {max(pitches):.1f} Hz   (spread {max(pitches) - min(pitches):.1f})")
    print(f"timbre  mean pairwise {np.mean(values):.2f} dB, worst {worst:.2f} dB")
    print(f"        worst pair: {os.path.basename(paths[left])} vs {os.path.basename(paths[right])}")
    print(f"body    {min(bodies):+.2f} to {max(bodies):+.2f} dB")


if __name__ == "__main__":
    main()
