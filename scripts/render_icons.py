"""Rasterize this icon's SVG rect/polygon primitives using Pillow (build time only)."""
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / 'icons' / 'icon.svg'


def render(size):
    scale = 8
    factor = size * scale / 128
    canvas = Image.new('RGBA', (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    for node in ET.parse(SVG).getroot():
        kind = node.tag.rsplit('}', 1)[-1]
        if kind in ('title', 'desc'):
            continue
        fill = node.attrib['fill']
        if kind == 'rect':
            x, y, width, height = [float(node.attrib[k]) * factor for k in ('x', 'y', 'width', 'height')]
            draw.rounded_rectangle((x, y, x + width, y + height),
                                   radius=float(node.attrib.get('rx', 0)) * factor, fill=fill)
        elif kind == 'polygon':
            points = [tuple(float(v) * factor for v in p.split(',')) for p in node.attrib['points'].split()]
            draw.polygon(points, fill=fill)
        else:
            raise ValueError('Unsupported SVG element: ' + kind)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == '__main__':
    for dimension in (16, 32, 48, 128):
        image = render(dimension)
        target = ROOT / 'icons' / f'icon-{dimension}.png'
        image.save(target, optimize=True)
        print(target.name)
