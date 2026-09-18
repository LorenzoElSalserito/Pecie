#!/usr/bin/env python3
"""
Vendor the bundled typography catalog into the desktop renderer.

    python3 scripts/vendor-fonts.py            # download (latin + latin-ext, woff2) then copy into the repo
    python3 scripts/vendor-fonts.py --copy-only <download-dir>

Sources: Google Fonts CSS API (OFL / Apache / UFL families) + the OpenDyslexic woff files
already stored in the repo. Output:
  apps/desktop/src/renderer/src/asset/fonts/<family>/*.woff2 (+ license text)
  apps/desktop/src/renderer/src/styles/fonts.css              (query-less local @font-face rules)
  apps/desktop/src/renderer/src/asset/fonts/LICENSE.md
Keep `packages/schemas/src/fonts.ts` (the runtime catalog) in sync with FAMILIES below.
Requires network access only when downloading; the app itself never fetches fonts.
"""
import json, os, re, sys, urllib.request, urllib.parse, time

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'build', 'fonts-download')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
# (family, axes-spec, license-dir-slug)
FAMILIES = [
 ('Source Serif 4','ital,opsz,wght@0,8..60,200..900;1,8..60,200..900'),
 ('Crimson Pro','ital,wght@0,200..900;1,200..900'),
 ('EB Garamond','ital,wght@0,400..800;1,400..800'),
 ('Libre Baskerville','ital,wght@0,400..700;1,400'),
 ('Merriweather','ital,opsz,wght@0,18..144,300..900;1,18..144,300..900'),
 ('Lora','ital,wght@0,400..700;1,400..700'),
 ('Literata','ital,opsz,wght@0,7..72,200..900;1,7..72,200..900'),
 ('Spectral','ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800'),
 ('Cormorant Garamond','ital,wght@0,300..700;1,300..700'),
 ('Libre Caslon Text','ital,wght@0,400;0,700;1,400'),
 ('Gentium Book Plus','ital,wght@0,400;0,700;1,400;1,700'),
 ('PT Serif','ital,wght@0,400;0,700;1,400;1,700'),
 ('Noto Serif','ital,wdth,wght@0,62.5..100,100..900;1,62.5..100,100..900'),
 ('Vollkorn','ital,wght@0,400..900;1,400..900'),
 ('Alegreya','ital,wght@0,400..900;1,400..900'),
 ('Cardo','ital,wght@0,400;0,700;1,400'),
 ('Newsreader','ital,opsz,wght@0,6..72,200..800;1,6..72,200..800'),
 ('Fraunces','ital,opsz,wght@0,9..144,100..900;1,9..144,100..900'),
 ('Bodoni Moda','ital,opsz,wght@0,6..96,400..900;1,6..96,400..900'),
 ('Brygada 1918','ital,wght@0,400..700;1,400..700'),
 ('Faustina','ital,wght@0,300..800;1,300..800'),
 ('Petrona','ital,wght@0,100..900;1,100..900'),
 ('Piazzolla','ital,opsz,wght@0,8..30,100..900;1,8..30,100..900'),
 ('STIX Two Text','ital,wght@0,400..700;1,400..700'),
 ('Old Standard TT','ital,wght@0,400;0,700;1,400'),
 ('Sorts Mill Goudy','ital@0;1'),
 ('Playfair Display','ital,wght@0,400..900;1,400..900'),
 ('Bitter','ital,wght@0,100..900;1,100..900'),
 ('Zilla Slab','ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700'),
 ('Roboto Slab','wght@100..900'),
 ('IBM Plex Serif','ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700'),
 ('IBM Plex Sans','ital,wdth,wght@0,85..100,100..700;1,85..100,100..700'),
 ('Inter','ital,opsz,wght@0,14..32,100..900;1,14..32,100..900'),
 ('Source Sans 3','ital,wght@0,200..900;1,200..900'),
 ('Work Sans','ital,wght@0,100..900;1,100..900'),
 ('Public Sans','ital,wght@0,100..900;1,100..900'),
 ('Fira Sans','ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700'),
 ('Noto Sans','ital,wdth,wght@0,62.5..100,100..900;1,62.5..100,100..900'),
 ('Lato','ital,wght@0,300;0,400;0,700;1,300;1,400;1,700'),
 ('Alegreya Sans','ital,wght@0,300;0,400;0,500;0,700;0,800;1,300;1,400;1,500;1,700;1,800'),
 ('PT Sans','ital,wght@0,400;0,700;1,400;1,700'),
 ('Open Sans','ital,wdth,wght@0,75..100,300..800;1,75..100,300..800'),
 ('Nunito Sans','ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000'),
 ('Manrope','wght@200..800'),
 ('DM Sans','ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000'),
 ('Cabin','ital,wdth,wght@0,75..100,400..700;1,75..100,400..700'),
 ('Atkinson Hyperlegible','ital,wght@0,400;0,700;1,400;1,700'),
 ('Lexend','wght@100..900'),
 ('IBM Plex Mono','ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700'),
 ('JetBrains Mono','ital,wght@0,100..800;1,100..800'),
 ('Source Code Pro','ital,wght@0,200..900;1,200..900'),
 ('Courier Prime','ital,wght@0,400;0,700;1,400;1,700'),
]
KEEP = {'latin','latin-ext'}
def slug(name): return re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                return data if binary else data.decode('utf-8')
        except Exception as e:
            time.sleep(2*(attempt+1)); err=e
    raise err
manifest = []
for family, axes in ([] if '--copy-only' in sys.argv else FAMILIES):
    s = slug(family)
    d = os.path.join(OUT, s); os.makedirs(d, exist_ok=True)
    url = 'https://fonts.googleapis.com/css2?family=' + urllib.parse.quote(family).replace('%20','+') + ':' + axes + '&display=swap'
    css = get(url)
    blocks = re.findall(r'/\* ([a-z-]+) \*/\s*@font-face \{(.*?)\}', css, re.S)
    faces = []
    for subset, body in blocks:
        if subset not in KEEP: continue
        m_style = re.search(r'font-style:\s*(\w+)', body); m_w = re.search(r'font-weight:\s*([\d\s.]+)', body)
        m_stretch = re.search(r'font-stretch:\s*([\d\s%.]+)', body)
        m_url = re.search(r'url\((https://[^)]+\.woff2)\)', body); m_range = re.search(r'unicode-range:\s*([^;]+);', body)
        style = m_style.group(1); weight = m_w.group(1).strip(); u = m_url.group(1)
        fname = f"{s}-{style}-{weight.replace(' ','_')}-{subset}.woff2"
        fpath = os.path.join(d, fname)
        if not os.path.exists(fpath):
            open(fpath,'wb').write(get(u, binary=True))
        faces.append({'file': f'{s}/{fname}', 'style': style, 'weight': weight, 'stretch': m_stretch.group(1).strip() if m_stretch else None, 'subset': subset, 'unicodeRange': m_range.group(1).strip()})
    # license
    lic = None
    for folder in ('ofl','apache','ufl'):
        for fn in ('OFL.txt','LICENSE.txt','UFL.txt'):
            try:
                lic_text = get(f'https://raw.githubusercontent.com/google/fonts/main/{folder}/{s.replace("-","")}/{fn}')
                lic = {'kind': folder, 'file': fn}; open(os.path.join(d, fn),'w').write(lic_text); break
            except Exception: pass
        if lic: break
    total = sum(os.path.getsize(os.path.join(d, os.path.basename(f['file']))) for f in faces)
    manifest.append({'family': family, 'slug': s, 'faces': faces, 'license': lic, 'bytes': total})
    print(f'{family}: {len(faces)} faces, {total//1024} KB, license={lic}', flush=True)
if '--copy-only' not in sys.argv:
    os.makedirs(OUT, exist_ok=True)
    json.dump(manifest, open(os.path.join(OUT,'manifest.json'),'w'), indent=1)
    print('TOTAL KB', sum(m['bytes'] for m in manifest)//1024)


# ── copy into the repository + generate fonts.css ─────────────────────────────
import shutil
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RENDERER = os.path.join(REPO, 'apps/desktop/src/renderer/src')
FONTS_DIR = os.path.join(RENDERER, 'asset/fonts')
KEEP_STATIC = {'normal': {'400', '500', '600', '700'}, 'italic': {'400', '700'}}

def vendor(manifest):
    css = ['/*',
           ' * Pecie bundled typography — generated by scripts/vendor-fonts.py (see asset/fonts/LICENSE.md).',
           ' * Every face is a local, query-less URL so it loads under file:// in the packaged app.',
           ' * Subsets: latin + latin-ext (unicode-range keeps unused files off the wire).',
           ' */', '']
    lic = ['# Bundled font licenses', '',
           'All fonts below are Free and Open Source and bundled with Pecie (`apps/desktop/src/renderer/src/asset/fonts/<family>/`).',
           'Each family directory contains its own license text.', '']
    for fam in manifest:
        slug = fam['slug']; dest = os.path.join(FONTS_DIR, slug)
        if os.path.isdir(dest): shutil.rmtree(dest)
        os.makedirs(dest)
        static = all(' ' not in f['weight'] for f in fam['faces'])
        kept = []
        for f in fam['faces']:
            if static and f['weight'] not in KEEP_STATIC[f['style']]: continue
            shutil.copy(os.path.join(OUT, f['file']), dest); kept.append(f)
        if fam['license']:
            shutil.copy(os.path.join(OUT, slug, fam['license']['file']), dest)
        lic.append(f"- **{fam['family']}** — {fam['license']['kind'].upper() if fam['license'] else 'OFL'} (`{slug}/{fam['license']['file'] if fam['license'] else 'OFL.txt'}`)")
        css.append(f"/* {fam['family']} */")
        for f in kept:
            css += ['@font-face {', f"  font-family: '{fam['family']}';", f"  font-style: {f['style']};", f"  font-weight: {f['weight']};"]
            if f['stretch']: css.append(f"  font-stretch: {f['stretch']};")
            css += ['  font-display: swap;', f"  src: url('../asset/fonts/{f['file']}') format('woff2');", f"  unicode-range: {f['unicodeRange']};", '}']
        css.append('')
    css.append('/* OpenDyslexic (vendored woff files, see open-dyslexic/LICENSE.txt) */')
    for name, style, weight in [('Regular', 'normal', 400), ('Italic', 'italic', 400), ('Bold', 'normal', 700), ('BoldItalic', 'italic', 700)]:
        css += ['@font-face {', "  font-family: 'OpenDyslexic';", f"  font-style: {style};", f"  font-weight: {weight};", '  font-display: swap;',
                f"  src: url('../asset/fonts/open-dyslexic/OpenDyslexic-{name}.woff') format('woff');", '}']
    lic.append('- **OpenDyslexic** — Bitstream Vera-derived license (`open-dyslexic/LICENSE.txt`)')
    lic.append('- **Bootstrap Icons** — MIT (`bootstrap-icons/LICENSE`)')
    css.append('')
    open(os.path.join(RENDERER, 'styles/fonts.css'), 'w').write('\n'.join(css))
    open(os.path.join(FONTS_DIR, 'LICENSE.md'), 'w').write('\n'.join(lic) + '\n')
    print('fonts.css faces:', css.count('@font-face {'))

if __name__ == '__main__':
    if '--copy-only' in sys.argv:
        OUT = sys.argv[sys.argv.index('--copy-only') + 1]
        vendor(json.load(open(os.path.join(OUT, 'manifest.json'))))
    else:
        vendor(manifest)
