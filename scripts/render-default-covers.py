"""Render the supplied linen SVG in the existing cover palette with Chromium."""

from pathlib import Path
import re
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/covers/11-varsayilan-keten.svg"
DEST = ROOT / "assets/covers/default-linen"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
COLORS = [
    "1B1B2F", "3347D9", "1C9A8E", "3E8E5A", "F2B632", "F28C38",
    "FF6B5A", "E58FB0", "7B5CD6", "6B6A78", "E9DFC9", "111111",
]


def tint(hex_color: str, amount: float) -> str:
    channels = [int(hex_color[i:i + 2], 16) for i in (0, 2, 4)]
    if amount >= 0:
        channels = [round(c + (255 - c) * amount) for c in channels]
    else:
        channels = [round(c * (1 + amount)) for c in channels]
    return "#" + "".join(f"{c:02X}" for c in channels)


def main() -> None:
    if not CHROME.exists():
        raise RuntimeError("Chrome is required to render the supplied SVG filters")
    svg = SOURCE.read_text(encoding="utf-8")
    assert 'viewBox="0 0 1200 1600"' in svg
    svg = re.sub(r"<metadata>.*?</metadata>", "", svg, flags=re.S)
    svg = svg.replace('width="1200" height="1600"', 'width="450" height="600"', 1)
    DEST.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="notex-linen-") as folder:
        temp = Path(folder)
        for color in COLORS:
            variant = svg.replace('stop-color="#5F7084"', f'stop-color="{tint(color, 0.12)}"', 1)
            variant = variant.replace('stop-color="#4A5A6E"', f'stop-color="{tint(color, -0.12)}"', 1)
            html = temp / "cover.html"
            html.write_text('<html><style>html,body{margin:0;width:450px;height:600px;overflow:hidden}svg{display:block;width:450px;height:600px}</style>' + variant + '</html>', encoding="utf-8")
            screenshot = temp / "capture.png"
            command = [str(CHROME), "--headless=new", "--no-first-run", "--no-default-browser-check",
                       "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=450,600",
                       f"--user-data-dir={temp / ('profile-' + color)}", f"--screenshot={screenshot}", html.as_uri()]
            subprocess.run(command, check=True, capture_output=True, timeout=45)
            with Image.open(screenshot) as image:
                if image.size[0] < 450 or image.size[1] < 600:
                    raise RuntimeError(f"Unexpected render size: {image.size}")
                image.crop((0, 0, 450, 600)).save(DEST / f"linen-{color.lower()}.png", optimize=True)
            screenshot.unlink()


if __name__ == "__main__":
    main()
