from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
STICKERS = ASSETS / "journal-stickers"


def connected_components(mask):
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components = []
    for y, x in zip(*np.where(mask & ~visited)):
        queue = deque([(y, x)])
        visited[y, x] = True
        points = []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))
        components.append(points)
    return components


def cutout(source, destination, keep=1, padding=10, min_component_ratio=0.002):
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image).astype(np.int16)
    height, width = rgb.shape[:2]
    border = np.concatenate((rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)))
    background = np.median(border, axis=0)
    distance = np.sqrt(np.sum((rgb - background) ** 2, axis=2))
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    brightness = rgb.mean(axis=2)

    # Paper texture is bright and low-chroma. Drawn outlines and colored fills survive.
    foreground = (distance > 23) & ((chroma > 11) | (brightness < 218))
    foreground_image = Image.fromarray((foreground * 255).astype(np.uint8))
    foreground = np.asarray(foreground_image.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))) > 0

    components = connected_components(foreground)
    components.sort(key=len, reverse=True)
    minimum = width * height * min_component_ratio
    selected = [component for component in components[:keep] if len(component) >= minimum]
    mask = np.zeros((height, width), dtype=np.uint8)
    for component in selected:
        ys, xs = zip(*component)
        mask[np.array(ys), np.array(xs)] = 255

    mask_image = Image.fromarray(mask).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.asarray(mask_image)
    ys, xs = np.where(alpha > 5)
    if not len(xs):
        raise ValueError(f"No foreground detected for {source}")
    left, right = max(0, xs.min() - padding), min(width, xs.max() + padding + 1)
    top, bottom = max(0, ys.min() - padding), min(height, ys.max() + padding + 1)
    result = image.convert("RGBA")
    result.putalpha(mask_image)
    result.crop((left, top, right, bottom)).save(destination)


def crop_icon_sheet():
    sheet = Image.open(ASSETS / "category-icons.png").convert("RGB")
    crops = {
        "exhibition": (512, 0, 1024, 420),
        "service": (1024, 0, 1536, 420),
        "supply": (0, 512, 512, 910),
        "checkin": (512, 512, 1024, 910),
        "entrance": (1024, 512, 1536, 910),
    }
    output = ASSETS / "category-icons"
    output.mkdir(exist_ok=True)
    for name, box in crops.items():
        temporary = output / f".{name}-source.png"
        sheet.crop(box).save(temporary)
        cutout(temporary, output / f"{name}.png", keep=1, padding=16, min_component_ratio=.006)
        temporary.unlink()


def cutout_stickers():
    sheet = Image.open(STICKERS / "sticker-sheet.png").convert("RGB")
    crops = {
        "building-classic": (15, 60, 155, 160),
        "building-modern": (160, 60, 300, 160),
        "thinker": (650, 60, 795, 200),
        "flower": (20, 590, 115, 710),
        "tree": (620, 420, 710, 555),
        "pink-tape": (170, 675, 315, 745),
        "pink-note": (1220, 195, 1375, 345),
        "photo-frame": (1215, 400, 1360, 575),
        "text-label": (830, 65, 935, 125),
        "camera-icon": (185, 400, 250, 475),
        "heart-icon": (1450, 860, 1525, 940),
        "paper-tag": (920, 610, 1000, 715),
    }
    keep_counts = {"photo-frame": 5}
    for name, box in crops.items():
        path = STICKERS / f"{name}.png"
        temporary = STICKERS / f".{name}-source.png"
        sheet.crop(box).save(temporary)
        cutout(temporary, path, keep=keep_counts.get(name, 1), padding=8, min_component_ratio=.008)
        temporary.unlink()


if __name__ == "__main__":
    crop_icon_sheet()
    cutout_stickers()
