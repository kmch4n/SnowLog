"""Measurements that describe a recorded voice.

Shared by check-narration-voice.py, which reports on the finished narration, and
pick-reference.py, which chooses the clip the narration is cloned from. Both need
the same numbers, and each of these was added because a defect got past the
measurements that existed at the time:

  median_pitch   The first thing measured, and on its own the least useful. Nine
                 files were once selected to agree on this figure to within
                 11.5 Hz while still sounding like nine different people.

  envelope       The spectral envelope, which is where speaker identity actually
                 lives. Stops at 4 kHz by default: above that a clean recording
                 sits near its own noise floor, and relative variation up there
                 swamped the comparison once the grit was removed.

  body_ratio     Low-mid against upper bands. Caught a 14.6 dB swing in tonal
                 balance between files that no pitch measurement could see.

  hnr            Harmonics against noise in the voiced parts. Roughness.

  hiss           Energy above 8 kHz against the speech band. This is the one that
                 explained audio described as gritty: a reference clip measuring
                 -32.7 dB here passed its noise into every line cloned from it,
                 while candidates generated from the same settings ranged from
                 -31.5 dB to -56.4 dB. The reference sets the floor.
"""

import wave

import numpy as np

FRAME_SECONDS = 0.04
HOP_SECONDS = 0.02
SILENCE_RMS = 0.02
MIN_HZ = 70
MAX_HZ = 400

ENVELOPE_BANDS = 24
ENVELOPE_LOW_HZ = 80
ENVELOPE_HIGH_HZ = 4000


def read(path: str) -> tuple[np.ndarray, int]:
    """Reads a mono WAV as floats in -1..1. Handles 16-bit and 32-bit float."""
    with wave.open(path) as handle:
        rate = handle.getframerate()
        width = handle.getsampwidth()
        raw = handle.readframes(handle.getnframes())

    if width == 2:
        return np.frombuffer(raw, dtype=np.int16).astype(float) / 32768, rate
    if width == 4:
        return np.frombuffer(raw, dtype=np.float32).astype(float), rate

    raise SystemExit(f"{path}: unsupported sample width {width}")


def voiced_frames(signal: np.ndarray, rate: int):
    window = int(rate * FRAME_SECONDS)
    hop = int(rate * HOP_SECONDS)
    for start in range(0, max(0, len(signal) - window), hop):
        frame = signal[start : start + window]
        if np.sqrt((frame**2).mean()) >= SILENCE_RMS:
            yield frame


def _spectra(signal: np.ndarray, rate: int):
    window = int(rate * FRAME_SECONDS)
    size = 1 << (window - 1).bit_length()
    hann = np.hanning(window)
    for frame in voiced_frames(signal, rate):
        yield np.abs(np.fft.rfft(frame * hann, size)) ** 2, size


def median_pitch(path: str) -> float:
    """Median F0 over voiced frames, by autocorrelation."""
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


def _mel(hz):
    return 2595 * np.log10(1 + np.asarray(hz, dtype=float) / 700)


def envelope(path: str, ceiling: float = ENVELOPE_HIGH_HZ) -> np.ndarray:
    """Level-normalised log spectral envelope, averaged over voiced frames."""
    signal, rate = read(path)
    window = int(rate * FRAME_SECONDS)
    size = 1 << (window - 1).bit_length()
    freqs = _mel(np.fft.rfftfreq(size, 1 / rate))
    edges = np.linspace(_mel(ENVELOPE_LOW_HZ), _mel(ceiling), ENVELOPE_BANDS + 1)
    bins = [np.where((freqs >= edges[i]) & (freqs < edges[i + 1]))[0] for i in range(ENVELOPE_BANDS)]

    total = np.zeros(ENVELOPE_BANDS)
    count = 0
    for spectrum, _ in _spectra(signal, rate):
        total += [spectrum[b].mean() if len(b) else 0.0 for b in bins]
        count += 1

    if count == 0:
        raise SystemExit(f"{path}: no voiced audio found")

    result = 10 * np.log10(total / count + 1e-12)
    # Remove overall level so loudness cannot pose as a timbre difference.
    return result - result.mean()


def envelope_distance(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.sqrt(((left - right) ** 2).mean()))


def body_ratio(path: str) -> float:
    """Low-mid energy against the upper bands, in dB. A thin voice scores low."""
    signal, rate = read(path)
    lows, highs = [], []
    for spectrum, size in _spectra(signal, rate):
        freqs = np.fft.rfftfreq(size, 1 / rate)
        lows.append(spectrum[(freqs >= 120) & (freqs < 600)].mean())
        highs.append(spectrum[(freqs >= 2000) & (freqs < 6000)].mean())

    return float(10 * np.log10(np.mean(lows) / np.mean(highs)))


def hnr(path: str) -> float:
    """Median harmonics-to-noise ratio over voiced frames, in dB."""
    signal, rate = read(path)
    window = int(rate * FRAME_SECONDS)
    low, high = int(rate / MAX_HZ), int(rate / MIN_HZ)

    values = []
    for frame in voiced_frames(signal, rate):
        frame = frame - frame.mean()
        correlation = np.correlate(frame, frame, "full")[window - 1 :]
        if high >= len(correlation) or correlation[0] <= 0:
            continue
        # The normalised autocorrelation at the pitch lag is the share of the
        # frame's energy that repeats. The remainder is noise.
        peak = float(np.clip(correlation[low:high].max() / correlation[0], 1e-6, 1 - 1e-6))
        values.append(10 * np.log10(peak / (1 - peak)))

    return float(np.median(values)) if values else 0.0


def hiss(path: str) -> float:
    """Energy above 8 kHz against the 300-3400 Hz speech band, in dB."""
    signal, rate = read(path)
    speech, top = [], []
    for spectrum, size in _spectra(signal, rate):
        freqs = np.fft.rfftfreq(size, 1 / rate)
        speech.append(spectrum[(freqs >= 300) & (freqs < 3400)].mean())
        top.append(spectrum[freqs >= 8000].mean())

    if not speech:
        raise SystemExit(f"{path}: no voiced audio found")

    return float(10 * np.log10(np.mean(top) / np.mean(speech)))
