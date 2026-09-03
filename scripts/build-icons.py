"""Regenerates src/components/pine-icons.tsx from src/assets/icons/*.svg."""
import re, os, glob

ATTR = {'fill-rule':'fillRule','clip-rule':'clipRule','stroke-width':'strokeWidth',
        'stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin',
        'stroke-miterlimit':'strokeMiterlimit','fill-opacity':'fillOpacity',
        'stroke-dasharray':'strokeDasharray','clip-path':'clipPath','xml:space':'xmlSpace'}

def component_name(slug):
    return ''.join(p.capitalize() for p in slug.split('-')) + 'Icon'

def convert(path):
    s = open(path, encoding='utf-8').read()
    view = re.search(r'viewBox="([^"]+)"', s).group(1)
    root = re.search(r'<svg[^>]*>', s).group(0)
    transform = re.search(r'transform="([^"]+)"', root)
    transform = transform.group(1) if transform else None

    s = re.sub(r'<!--.*?-->|<!DOCTYPE.*?>|<\?xml.*?\?>', '', s, flags=re.S)
    s = re.sub(r'<title>.*?</title>|<desc>.*?</desc>', '', s, flags=re.S)
    # a <style> block colours through CSS classes, which cannot survive inlining
    s = re.sub(r'<style[^>]*>.*?</style>', '', s, flags=re.S)
    # SVG Repo scaffolding
    s = re.sub(r'<g id="SVGRepo_(bg|tracer)Carrier"[^>]*/>', '', s)
    m = re.search(r'<g id="SVGRepo_iconCarrier"[^>]*>(.*)</g>', s, flags=re.S)
    inner = m.group(1) if m else re.search(r'<svg[^>]*>(.*)</svg>', s, flags=re.S).group(1)

    # <defs>/clipPath carry document-wide ids that would collide once several
    # icons share a page; every clip here is just the full viewBox anyway.
    inner = re.sub(r'<defs>.*?</defs>', '', inner, flags=re.S)
    inner = re.sub(r'<g clip-path="[^"]*">(.*)</g>', r'\1', inner, flags=re.S)
    # a white backing rect would paint a solid box behind the glyph
    inner = re.sub(r'<rect[^>]*fill="white"[^>]*/>', '', inner)
    # colour comes from the surrounding text colour
    inner = re.sub(r'(fill|stroke)="(#000000|#000|#00000|black)"', r'\1="currentColor"', inner)
    inner = re.sub(r'\s(id|class)="[^"]*"', '', inner)
    for a, b in ATTR.items():
        inner = inner.replace(a + '=', b + '=')
    inner = re.sub(r'\s+', ' ', inner).strip()
    if transform:
        # On a root <svg> a rotate() spins about the element's centre (CSS
        # transform-origin); on an inner <g> it spins about (0,0) and throws the
        # glyph off-canvas. Pin it to the viewBox centre so it looks the same.
        m = re.fullmatch(r'rotate\((-?[\d.]+)\)', transform.strip())
        if m:
            x, y, w, h = (float(v) for v in view.replace(',', ' ').split())
            transform = f'rotate({m.group(1)} {x + w / 2:g} {y + h / 2:g})'
        inner = f'<g transform="{transform}">{inner}</g>'
    return view, inner

parts = []
for path in sorted(glob.glob('src/assets/icons/*.svg')):
    slug = os.path.splitext(os.path.basename(path))[0]
    view, inner = convert(path)
    parts.append(
        f'/** {slug}.svg */\n'
        f'export function {component_name(slug)}({{ className }}: IconProps) {{\n'
        f'  return (\n'
        f'    <svg viewBox="{view}" className={{className}} fill="currentColor"\n'
        f'         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n'
        f'      {inner}\n'
        f'    </svg>\n'
        f'  );\n}}'
    )

header = '''/**
 * Pine's icon set — every dashboard icon lives here.
 *
 * Generated from src/assets/icons/*.svg by scripts/build-icons.py. The SVGs are
 * inlined as components rather than loaded as files so they take their colour
 * and size from the surrounding text and a className, the way an icon font
 * would. Re-run the script after adding or replacing a source file:
 *
 *     python scripts/build-icons.py
 *
 * They are solid glyphs, so they read a little heavier than a stroked set at
 * the same box size.
 */
type IconProps = { className?: string };

'''
open('src/components/pine-icons.tsx', 'w', encoding='utf-8').write(header + '\n\n'.join(parts) + '\n')
print('generated', len(parts), 'icons')
