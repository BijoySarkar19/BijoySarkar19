#!/usr/bin/env python3
"""Fetch the current GitHub profile avatar and render a circular PNG for README."""
import io
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

USERNAME = os.environ.get("GITHUB_USERNAME", "BijoySarkar19")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
OUTPUT = Path("assets/profile-avatar.png")
SIZE = 768

def fetch(url: str, token: str = "") -> bytes:
    headers = {
        "User-Agent": "BijoySarkar-profile-avatar-sync",
        "Accept": "application/vnd.github+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()

def main() -> None:
    user_data = json.loads(fetch(f"https://api.github.com/users/{USERNAME}", TOKEN))
    avatar_url = user_data.get("avatar_url")
    if not avatar_url:
        raise RuntimeError(f"GitHub API did not return avatar_url for {USERNAME}")

    # Request a high-resolution avatar from GitHub's official avatar CDN.
    separator = "&" if "?" in avatar_url else "?"
    image_url = f"{avatar_url}{separator}s=768"
    raw = fetch(image_url, TOKEN)

    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        # GitHub avatars are square; ImageOps.fit also handles any unexpected aspect ratio.
        image = ImageOps.fit(image, (SIZE, SIZE), method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))

    # Make a true transparent circular crop (README style attributes are stripped by GitHub).
    scale = 4
    mask_hi = Image.new("L", (SIZE * scale, SIZE * scale), 0)
    ImageDraw.Draw(mask_hi).ellipse((3 * scale, 3 * scale, (SIZE - 3) * scale, (SIZE - 3) * scale), fill=255)
    mask = mask_hi.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.paste(image, (0, 0))
    result.putalpha(mask)

    # Gradient ring: cyan through blue into violet.
    draw = ImageDraw.Draw(result)
    box = (18, 18, SIZE - 18, SIZE - 18)
    for degree in range(360):
        t = degree / 359
        start = (56, 189, 248)
        end = (168, 85, 247)
        color = tuple(round(start[i] * (1 - t) + end[i] * t) for i in range(3)) + (255,)
        draw.arc(box, start=degree, end=degree + 1, fill=color, width=9)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUTPUT, format="PNG", optimize=True)
    print(f"Updated {OUTPUT} from @{USERNAME}'s current GitHub avatar.")

if __name__ == "__main__":
    try:
        main()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError, RuntimeError) as exc:
        print(f"Avatar refresh failed: {exc}", file=sys.stderr)
        raise
