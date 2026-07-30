"""Reports whether the narration files are one voice, and a clean one.

    python scripts/check-narration-voice.py public/audio/narration/*.wav

Every column here exists because a defect got past whatever was being measured
at the time. The measurements themselves live in voiceprint.py.

  pitch     Least useful on its own. An earlier generator synthesised each line
            six times and kept the take closest to a target pitch; it drove the
            spread across the nine files to 11.5 Hz and the files still sounded
            like different people.

  envelope  Where speaker identity lives. It was 6.25 dB apart while pitch
            looked tidy.

  body      Low-mid against upper bands. Was swinging 14.6 dB between files.

  HNR/hiss  Roughness, and noise above 8 kHz. Added after audio described as
            gritty turned out to come from a noisy reference clip passing its
            own hiss into every line cloned from it.

Absolute numbers mean little: two sentences contain different phonemes, so even
one speaker reading both shows a nonzero envelope distance. Comparing two halves
of a single recording puts that floor near 4.8 dB. Use these figures to compare
two generation settings over the *same* lines, where the phonetic floor is common
to both and cancels out.
"""

import os
import sys

import numpy as np

import voiceprint as vp


def main() -> None:
    paths = sys.argv[1:]

    if len(paths) < 2:
        raise SystemExit("give at least two wav files")

    pitches = [vp.median_pitch(path) for path in paths]
    envelopes = [vp.envelope(path) for path in paths]
    bodies = [vp.body_ratio(path) for path in paths]
    hnrs = [vp.hnr(path) for path in paths]
    hisses = [vp.hiss(path) for path in paths]

    print(f"  {'file':14s}{'pitch':>9}{'body':>9}{'HNR':>8}{'hiss':>9}")
    for path, pitch, body, harmonic, noise in zip(paths, pitches, bodies, hnrs, hisses):
        print(
            f"  {os.path.basename(path):14s}{pitch:7.1f}Hz{body:+8.2f}{harmonic:+8.2f}{noise:+9.2f}"
        )

    distances = [
        (vp.envelope_distance(envelopes[i], envelopes[j]), i, j)
        for i in range(len(paths))
        for j in range(i + 1, len(paths))
    ]
    worst, left, right = max(distances)
    values = [distance for distance, _, _ in distances]

    print()
    print(f"pitch     {min(pitches):.1f} - {max(pitches):.1f} Hz   (spread {max(pitches) - min(pitches):.1f})")
    print(f"envelope  mean pairwise {np.mean(values):.2f} dB, worst {worst:.2f} dB   (floor is about 4.8)")
    print(f"          worst pair: {os.path.basename(paths[left])} vs {os.path.basename(paths[right])}")
    print(f"body      {min(bodies):+.2f} to {max(bodies):+.2f} dB")
    print(f"HNR       {min(hnrs):+.2f} to {max(hnrs):+.2f} dB   (higher is less rough)")
    print(f"hiss      {min(hisses):+.2f} to {max(hisses):+.2f} dB   (lower is cleaner)")


if __name__ == "__main__":
    main()
