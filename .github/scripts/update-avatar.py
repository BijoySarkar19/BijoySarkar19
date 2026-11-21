
import os
import sys
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageDraw

USERNAME = os.environ.get("GITHUB_USERNAME", "BijoySarkar19")
TOKEN = os.environ.get("GITHUB_TOKEN")

OUTPUT = Path("assets/profile-avatar.png")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

if not TOKEN:
    sys.exit("GITHUB_TOKEN is missing.")

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

try:
    profile_response = requests.get(
        f"https://api.github.com/users/{USERNAME}",
        headers=headers,
        timeout=30,
    )
    profile_response.raise_for_status()

    profile = profile_response.json()
    avatar_url = profile["avatar_url"]

    image_response = requests.get(
        avatar_url,
        headers=headers,
        timeout=30,
    )
    image_response.raise_for_status()

    image = Image.open(BytesIO(image_response.content)).convert("RGBA")

    size = 512
    image = image.resize(
        (size, size),
        Image.Resampling.LANCZOS,
    )

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)

    image.putalpha(mask)

    image.save(OUTPUT, "PNG", optimize=True)

    print(f"Updated avatar: {OUTPUT}")

except Exception as error:
    sys.exit(f"Avatar update failed: {error}")
