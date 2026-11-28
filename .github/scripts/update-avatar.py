import os
import sys
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter

USERNAME = os.environ.get("GITHUB_USERNAME", "BijoySarkar19")
TOKEN = os.environ.get("GITHUB_TOKEN")

OUTPUT = Path("assets/profile-avatar.png")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
}
if TOKEN:
    headers["Authorization"] = f"Bearer {TOKEN}"
    headers["X-GitHub-Api-Version"] = "2022-11-28"

try:
    avatar_url = f"https://github.com/{USERNAME}.png"
    if TOKEN:
        try:
            profile_response = requests.get(
                f"https://api.github.com/users/{USERNAME}",
                headers=headers,
                timeout=30,
            )
            if profile_response.status_code == 200:
                avatar_url = profile_response.json().get("avatar_url", avatar_url)
        except Exception as e:
            print(f"Notice: Could not fetch from API, falling back to direct URL: {e}")

    print(f"Fetching avatar from: {avatar_url}")
    image_response = requests.get(avatar_url, headers=headers, timeout=30)
    image_response.raise_for_status()

    raw_img = Image.open(BytesIO(image_response.content)).convert("RGBA")
    size = 512
    border_width = 8
    glow_width = 12

    # Supersample for ultra-smooth antialiasing
    scale = 2
    ss_size = size * scale
    ss_bw = border_width * scale
    ss_gw = glow_width * scale

    img_resized = raw_img.resize((ss_size, ss_size), Image.Resampling.LANCZOS)

    # Circular mask for avatar content
    mask = Image.new("L", (ss_size, ss_size), 0)
    draw_mask = ImageDraw.Draw(mask)
    margin = ss_bw // 2
    draw_mask.ellipse((margin, margin, ss_size - 1 - margin, ss_size - 1 - margin), fill=255)

    avatar_circle = Image.new("RGBA", (ss_size, ss_size), (0, 0, 0, 0))
    avatar_circle.paste(img_resized, (0, 0), mask=mask)

    # Glowing outer cyan ring
    glow_layer = Image.new("RGBA", (ss_size, ss_size), (0, 0, 0, 0))
    draw_glow = ImageDraw.Draw(glow_layer)
    draw_glow.ellipse((margin, margin, ss_size - 1 - margin, ss_size - 1 - margin), outline=(0, 242, 254, 180), width=ss_bw + ss_gw)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=6 * scale))

    # Crisp solid cyan border ring
    ring_layer = Image.new("RGBA", (ss_size, ss_size), (0, 0, 0, 0))
    draw_ring = ImageDraw.Draw(ring_layer)
    draw_ring.ellipse((margin, margin, ss_size - 1 - margin, ss_size - 1 - margin), outline=(0, 242, 254, 255), width=ss_bw)

    # Composite layers
    final = Image.new("RGBA", (ss_size, ss_size), (0, 0, 0, 0))
    final = Image.alpha_composite(final, glow_layer)
    final = Image.alpha_composite(final, avatar_circle)
    final = Image.alpha_composite(final, ring_layer)

    # Downsample to target size
    final = final.resize((size, size), Image.Resampling.LANCZOS)
    final.save(OUTPUT, "PNG", optimize=True)

    print(f"Updated circular avatar with glowing border: {OUTPUT}")

except Exception as error:
    sys.exit(f"Avatar update failed: {error}")
