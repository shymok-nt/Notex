import json
import re
from pathlib import Path
from io import BytesIO
from PIL import Image
import cairosvg

source = Path('components/notexBrandAssets.ts').read_text(encoding='utf-8')
match = re.search(r'export const notexIconSvg = ("(?:\\.|[^"\\])*");', source)
if not match:
    raise RuntimeError('Notex SVG source not found')
svg = json.loads(match.group(1))
svg = svg.replace('viewBox="0 0 580 560"', 'viewBox="90 75 440 440"')
icons = Path('src-tauri/icons')
icons.mkdir(parents=True, exist_ok=True)
png = cairosvg.svg2png(bytestring=svg.encode(), output_width=512, output_height=512)
master = Image.open(BytesIO(png)).convert('RGBA')
for size, name in [(32, '32x32.png'), (128, '128x128.png'), (256, '128x128@2x.png'), (512, 'icon.png')]:
    master.resize((size, size), Image.Resampling.LANCZOS).save(icons / name)
master.save(icons / 'icon.ico', format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Updated native Windows taskbar, title-bar and installer icons from Notex SVG')
