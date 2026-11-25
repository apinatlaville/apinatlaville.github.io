#!/usr/bin/env python3
"""Génère AppIcon.icns (carré arrondi bleu + PC) sans dépendances."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

BLUE = (0x5B, 0x9A, 0xFF, 255)
INK = (0x0E, 0x15, 0x24, 255)

# Polices bitmap 6×7, traits doubles (lisible en icône Dock)
FONT = {
    "P": [
        "111110",
        "110011",
        "110011",
        "111110",
        "110000",
        "110000",
        "110000",
    ],
    "C": [
        "011111",
        "110011",
        "110000",
        "110000",
        "110000",
        "110011",
        "011111",
    ],
}


def png_rgba(width: int, height: int, pixels: bytearray) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def rounded_mask(size: int, radius: int, x: int, y: int) -> float:
    """Couverture 0..1 du pixel (anti-alias coins)."""
    dx = min(x + 0.5, size - x - 0.5)
    dy = min(y + 0.5, size - y - 0.5)
    if dx >= radius or dy >= radius:
        return 1.0
    cx = radius - dx
    cy = radius - dy
    dist = (cx * cx + cy * cy) ** 0.5
    edge = dist - radius
    if edge <= -0.6:
        return 1.0
    if edge >= 0.6:
        return 0.0
    return max(0.0, min(1.0, 0.5 - edge))


def blit_letter(px: bytearray, size: int, glyph: list[str], ox: int, oy: int, cell: int) -> None:
    rows, cols = len(glyph), len(glyph[0])
    for gy, row in enumerate(glyph):
        for gx, ch in enumerate(row):
            if ch != "1":
                continue
            x0, y0 = ox + gx * cell, oy + gy * cell
            for yy in range(cell):
                for xx in range(cell):
                    x, y = x0 + xx, y0 + yy
                    if 0 <= x < size and 0 <= y < size:
                        i = (y * size + x) * 4
                        px[i : i + 4] = bytes(INK)


def make_png(size: int) -> bytes:
    px = bytearray(size * size * 4)
    radius = max(2, int(size * 0.22))
    for y in range(size):
        for x in range(size):
            a = rounded_mask(size, radius, x, y)
            i = (y * size + x) * 4
            if a <= 0:
                continue
            px[i] = BLUE[0]
            px[i + 1] = BLUE[1]
            px[i + 2] = BLUE[2]
            px[i + 3] = int(255 * a)
    cell = max(1, size // 14)
    gap = max(1, cell)
    letter_w = 6 * cell
    letter_h = 7 * cell
    total_w = letter_w * 2 + gap
    ox = (size - total_w) // 2
    oy = (size - letter_h) // 2
    blit_letter(px, size, FONT["P"], ox, oy, cell)
    blit_letter(px, size, FONT["C"], ox + letter_w + gap, oy, cell)
    return png_rgba(size, size, px)


def make_icns(pngs: dict[str, bytes]) -> bytes:
    chunks = []
    for tag, data in pngs.items():
        payload = tag.encode("ascii") + struct.pack(">I", len(data) + 8) + data
        chunks.append(payload)
    body = b"".join(chunks)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    resources = here / "Mes Cours.app" / "Contents" / "Resources"
    resources.mkdir(parents=True, exist_ok=True)
    sizes = {
        "ic10": 1024,  # 1024
        "ic09": 512,
        "ic14": 512,  # 256@2x
        "ic08": 256,
        "ic13": 256,  # 128@2x
        "ic07": 128,
        "ic12": 64,  # 32@2x
        "ic11": 32,  # 16@2x
    }
    pngs = {tag: make_png(sz) for tag, sz in sizes.items()}
    icns = make_icns(pngs)
    (resources / "AppIcon.icns").write_bytes(icns)
    (resources / "AppIcon-1024.png").write_bytes(pngs["ic10"])
    print(f"icns {len(icns)} octets → {resources / 'AppIcon.icns'}")


if __name__ == "__main__":
    main()
