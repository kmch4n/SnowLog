"""Derives the screen cutout mask from a device bezel PNG.

The bezel has both the screen and the area outside the phone as transparency,
so a plain alpha threshold cannot tell them apart. Flooding from the image
border marks everything outside the device; whatever transparency survives is
the screen cutout.

The result is used as a CSS mask in DeviceFrame, which is the only way to clip
the recording to Apple's screen corners exactly. They are squircles, not
circular arcs, so a CSS border-radius leaves the video poking out at the
corners no matter what radius is chosen.

    python scripts/make-screen-mask.py <bezel.png> <mask.png>
"""

from collections import deque
import sys

import numpy as np
from PIL import Image

TRANSPARENT = 8  # alpha at or below this counts as a hole


def outside_mask(hole: np.ndarray) -> np.ndarray:
    """Flood transparency inward from the border to find the area off-device."""
    height, width = hole.shape
    outside = np.zeros_like(hole)
    queue: deque = deque()

    for x in range(width):
        for y in (0, height - 1):
            if hole[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if hole[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width:
                if hole[ny, nx] and not outside[ny, nx]:
                    outside[ny, nx] = True
                    queue.append((ny, nx))

    return outside


def main() -> None:
    bezel_path, mask_path = sys.argv[1], sys.argv[2]

    bezel = Image.open(bezel_path).convert("RGBA")
    alpha = np.array(bezel)[:, :, 3]
    hole = alpha <= TRANSPARENT
    screen = hole & ~outside_mask(hole)

    if not screen.any():
        raise SystemExit(f"No screen cutout found in {bezel_path}")

    mask = np.zeros((*screen.shape, 4), dtype=np.uint8)
    mask[screen] = (255, 255, 255, 255)
    Image.fromarray(mask, "RGBA").save(mask_path)

    ys, xs = np.where(screen)
    left, right = int(xs.min()), int(xs.max()) + 1
    top, bottom = int(ys.min()), int(ys.max()) + 1
    height, width = screen.shape

    # Printed so the fractions in DeviceFrame can be checked against reality
    # rather than trusted. They were wrong once already.
    print(f"bezel      {width} x {height}")
    print(f"screen     x {left}..{right}  y {top}..{bottom}  ({right - left} x {bottom - top})")
    print("fractions  " + ", ".join(
        f"{name} {value:.6f}"
        for name, value in (
            ("left", left / width),
            ("top", top / height),
            ("width", (right - left) / width),
            ("height", (bottom - top) / height),
        )
    ))


if __name__ == "__main__":
    main()
