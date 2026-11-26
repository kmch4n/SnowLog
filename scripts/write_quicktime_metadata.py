#!/usr/bin/env python3
"""Write iPhone-style QuickTime metadata (moov/meta: hdlr 'mdta' + keys + ilst) into a .mov.

Used by scripts/make_maestro_media.sh for the iOS simulator test videos (#98).
ffmpeg's `-movflags use_metadata_tags` writes the mdta keys into moov/udta/meta,
which Photos ignores, so a clip made that way enters the simulator's library with
no location. This tool writes them where the Camera app and AVFoundation put them:
a QuickTime-style 'meta' atom directly under 'moov'. Verified on an iOS 26
simulator: Photos stores both the location and the capture date from it.

Usage:
    python3 -I write_quicktime_metadata.py IN.mov OUT.mov [--iso6709 "+36.6983+137.8320+700.000/"] \
        [--creationdate 2026-11-07T10:15:00+0900] [--accuracy 5.0] \
        [--device-keys] [--drop-udta] [--xyz]

--drop-udta  removes the movie-level udta (ffmpeg's udta/meta, ©swr, loci) first.
--xyz        also writes a classic udta/©xyz location string (QuickTime user data).
--device-keys adds make/model/software keys like a phone recording.
Chunk offsets (stco/co64) are shifted when moov precedes mdat.
"""

import argparse
import struct
import sys


def box(typ: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", 8 + len(payload), typ) + payload


def iter_boxes(data: bytes, off: int, end: int):
    while off + 8 <= end:
        size, typ = struct.unpack(">I4s", data[off:off + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack(">Q", data[off + 8:off + 16])[0]
            hdr = 16
        elif size == 0:
            size = end - off
        if size < hdr or off + size > end:
            raise ValueError(f"bad box {typ!r} size {size} at {off}")
        yield off, size, typ, hdr
        off += size


def utf8_item(index: int, value: str) -> bytes:
    # 'data' atom: type indicator (reserved byte 0 + well-known type 1 = UTF-8),
    # locale 0 (default), then the value.
    data_atom = box(b"data", struct.pack(">II", 1, 0) + value.encode("utf-8"))
    return box(struct.pack(">I", index), data_atom)


def build_meta(items: list) -> bytes:
    # hdlr: version/flags, pre_defined (0), handler 'mdta', 3x reserved, empty name.
    hdlr = box(b"hdlr", struct.pack(">I4s4s12x", 0, b"\0\0\0\0", b"mdta") + b"\0")
    keys_payload = struct.pack(">II", 0, len(items))
    for key, _ in items:
        keys_payload += box(b"mdta", key.encode("utf-8"))
    keys = box(b"keys", keys_payload)
    ilst = box(b"ilst", b"".join(utf8_item(i + 1, v) for i, (_, v) in enumerate(items)))
    # QuickTime 'meta' under moov has no version/flags (unlike the MP4 FullBox form).
    return box(b"meta", hdlr + keys + ilst)


def build_xyz(value: str) -> bytes:
    text = value.encode("utf-8")
    # 16-bit length + 16-bit packed language code (0x15C7 = 'eng').
    return box(b"\xa9xyz", struct.pack(">HH", len(text), 0x15C7) + text)


def shift_chunk_offsets(moov: bytearray, delta: int) -> None:
    def walk(off: int, end: int):
        for b_off, size, typ, hdr in iter_boxes(moov, off, end):
            if typ in (b"trak", b"mdia", b"minf", b"stbl"):
                walk(b_off + hdr, b_off + size)
            elif typ == b"stco":
                n = struct.unpack(">I", moov[b_off + hdr + 4:b_off + hdr + 8])[0]
                p = b_off + hdr + 8
                for i in range(n):
                    v = struct.unpack(">I", moov[p + 4 * i:p + 4 * i + 4])[0] + delta
                    moov[p + 4 * i:p + 4 * i + 4] = struct.pack(">I", v)
            elif typ == b"co64":
                n = struct.unpack(">I", moov[b_off + hdr + 4:b_off + hdr + 8])[0]
                p = b_off + hdr + 8
                for i in range(n):
                    v = struct.unpack(">Q", moov[p + 8 * i:p + 8 * i + 8])[0] + delta
                    moov[p + 8 * i:p + 8 * i + 8] = struct.pack(">Q", v)

    walk(8, len(moov))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--iso6709")
    ap.add_argument("--creationdate")
    ap.add_argument("--accuracy")
    ap.add_argument("--device-keys", action="store_true")
    ap.add_argument("--drop-udta", action="store_true")
    ap.add_argument("--xyz", action="store_true")
    args = ap.parse_args()

    with open(args.src, "rb") as f:
        data = f.read()

    items = []
    if args.accuracy:
        items.append(("com.apple.quicktime.location.accuracy.horizontal", args.accuracy))
    if args.iso6709:
        items.append(("com.apple.quicktime.location.ISO6709", args.iso6709))
    if args.device_keys:
        items += [
            ("com.apple.quicktime.make", "Apple"),
            ("com.apple.quicktime.model", "iPhone"),
            ("com.apple.quicktime.software", "26.0"),
        ]
    if not items and not args.creationdate:
        raise SystemExit("nothing to write: pass --iso6709 and/or --creationdate")
    if args.creationdate:
        items.append(("com.apple.quicktime.creationdate", args.creationdate))

    out = bytearray()
    moov_off = mdat_off = None
    for off, size, typ, hdr in iter_boxes(data, 0, len(data)):
        if typ == b"mdat" and mdat_off is None:
            mdat_off = off
        if typ != b"moov":
            out += data[off:off + size]
            continue
        moov_off = off
        if hdr != 8:
            raise SystemExit("64-bit moov size not supported")
        children = b""
        udta_extra = build_xyz(args.iso6709) if args.xyz and args.iso6709 else b""
        has_udta = False
        for c_off, c_size, c_typ, _ in iter_boxes(data, off + 8, off + size):
            if c_typ == b"meta":
                continue  # replace any existing moov-level meta
            if c_typ == b"udta":
                if args.drop_udta:
                    continue
                has_udta = True
                if udta_extra:
                    # append ©xyz to the existing udta
                    payload = data[c_off + 8:c_off + c_size] + udta_extra
                    children += box(b"udta", payload)
                    continue
            children += data[c_off:c_off + c_size]
        if udta_extra and not has_udta:
            children += box(b"udta", udta_extra)
        children += build_meta(items)
        new_moov = bytearray(box(b"moov", children))
        delta = len(new_moov) - size
        if mdat_off is None and delta:  # moov precedes mdat: offsets move
            shift_chunk_offsets(new_moov, delta)
        out += new_moov
    if moov_off is None:
        raise SystemExit("no moov box")
    with open(args.dst, "wb") as f:
        f.write(out)
    print(f"wrote {args.dst}: {len(items)} mdta keys in moov/meta")
    return 0


if __name__ == "__main__":
    sys.exit(main())
