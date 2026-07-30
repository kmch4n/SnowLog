"""Chooses which candidate clip the narration should be cloned from.

    python scripts/pick-reference.py <candidate.wav> [candidate.wav ...]

Prints the winning index on stdout and a table on stderr. An index rather than a
path on purpose: this repository sits under a directory containing Japanese
characters, and a path printed back through the Windows console codepage arrives
mangled.

Why a selection step exists at all: the reference sets a floor that every cloned
line inherits, and the model does not produce equally clean clips. Eight
candidates from identical settings, differing only in seed, measured anywhere
from -31.5 dB to -56.4 dB of energy above 8 kHz. The first reference chosen
without measuring landed at -32.7 dB, and the narration built on it was audibly
gritty. Picking the quietest candidate instead put the finished lines past
-60 dB.

Ranking on hiss alone was the first attempt and it picked the wrong clip. The
quietest of the eight candidates also had the *weakest* harmonics of the eight,
and the lines cloned from it came out rougher (HNR 2.58 dB) than lines from a
candidate 10 dB hissier but far more harmonic (3.62 dB). Clean is not the same as
solid.

So: hiss is treated as a requirement rather than a score. Once a candidate is
quiet enough for the noise to sit inaudibly far below the speech, further
quietness buys nothing, and harmonicity decides. Speaker consistency does not
enter into it -- the spread it produces across lines sits below this metric's own
floor of 4.8 dB, established by comparing two halves of a single recording.
"""

import os
import sys

# Python puts this script's own directory on the path, so voiceprint resolves
# without any help.
import voiceprint as vp

# Energy this far below the speech band is inaudible against it, so a candidate
# past this point is clean enough and harmonicity decides the rest.
QUIET_ENOUGH_DB = -50


def main() -> None:
    candidates = sys.argv[1:]

    if not candidates:
        raise SystemExit("no candidates given")

    measured = []
    for path in candidates:
        noise, harmonic = vp.hiss(path), vp.hnr(path)
        measured.append((noise, harmonic))
        print(
            f"  {os.path.basename(path):26s} hiss {noise:6.2f} dB   "
            f"HNR {harmonic:5.2f} dB   pitch {vp.median_pitch(path):6.1f} Hz",
            file=sys.stderr,
        )

    quiet = [index for index, (noise, _) in enumerate(measured) if noise <= QUIET_ENOUGH_DB]

    if quiet:
        winner = max(quiet, key=lambda index: measured[index][1])
        why = f"quietest tier (hiss <= {QUIET_ENOUGH_DB} dB), most harmonic of it"
    else:
        # Nothing reached the bar, so cleanliness is still the binding problem.
        winner = min(range(len(measured)), key=lambda index: measured[index][0])
        why = f"nothing reached {QUIET_ENOUGH_DB} dB, so the quietest wins"

    print(f"  -> {os.path.basename(candidates[winner])}  ({why})", file=sys.stderr)
    print(winner)


if __name__ == "__main__":
    main()
