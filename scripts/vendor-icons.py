#!/usr/bin/env python3
"""
Regenerate packages/ui/src/icons/bootstrap-icon-paths.ts from Bootstrap Icons.

    python3 scripts/vendor-icons.py [--version 1.13.1] [--source-dir <dir-with-svgs>]

The icon names are the explicit ICONS list below (add a name there when the UI needs a new
glyph; the unit tests fail if a component references an unknown icon). Each SVG source is downloaded
from the twbs/icons repository (or read from --source-dir), its <path> data is extracted and
written as TypeScript. The app never loads SVG files or icon fonts: every glyph is part of the
JavaScript bundle, so icons render identically under file:// in every packaged build.
"""
import os, re, sys, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'packages/ui/src/icons/bootstrap-icon-paths.ts')
ICONS = [
    '123',
    'archive',
    'arrow-counterclockwise',
    'arrow-down',
    'arrow-left',
    'arrow-right',
    'arrow-up',
    'asterisk',
    'bar-chart-line',
    'blockquote-left',
    'book',
    'bookmark-star',
    'box-arrow-up',
    'bug',
    'bullseye',
    'camera-video',
    'card-image',
    'chat-left-quote',
    'check-lg',
    'check2',
    'check2-square',
    'chevron-double-left',
    'chevron-double-right',
    'chevron-down',
    'chevron-right',
    'chevron-up',
    'clipboard',
    'clock',
    'clock-history',
    'code',
    'code-square',
    'collection',
    'compass',
    'diagram-2',
    'diagram-3',
    'eye',
    'file-earmark-break',
    'file-earmark-image',
    'file-earmark-richtext',
    'file-earmark-text',
    'film',
    'flag',
    'folder2-open',
    'fonts',
    'gear',
    'heart-fill',
    'highlighter',
    'image',
    'info-circle',
    'journal-bookmark',
    'journal-code',
    'journal-text',
    'keyboard',
    'layout-sidebar',
    'layout-sidebar-inset',
    'layout-sidebar-inset-reverse',
    'layout-sidebar-reverse',
    'layout-split',
    'layout-text-window-reverse',
    'link-45deg',
    'list-ol',
    'list-ul',
    'markdown',
    'mortarboard',
    'newspaper',
    'paperclip',
    'pen',
    'pencil-square',
    'person',
    'plus-circle',
    'plus-lg',
    'plus-square',
    'puzzle',
    'rocket-takeoff',
    'search',
    'share',
    'shield-lock',
    'sort-down',
    'sort-up',
    'subscript',
    'superscript',
    'table',
    'three-dots',
    'trash3',
    'type-bold',
    'type-h2',
    'type-italic',
    'type-strikethrough',
    'type-underline',
    'x-lg',
]
VERSION = sys.argv[sys.argv.index('--version') + 1] if '--version' in sys.argv else '1.13.1'
SOURCE_DIR = sys.argv[sys.argv.index('--source-dir') + 1] if '--source-dir' in sys.argv else None


def fetch(name: str) -> str:
    if SOURCE_DIR:
        with open(os.path.join(SOURCE_DIR, f'{name}.svg'), encoding='utf-8') as handle:
            return handle.read()
    url = f'https://raw.githubusercontent.com/twbs/icons/v{VERSION}/icons/{name}.svg'
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode('utf-8')


def main() -> None:
    names = sorted(set(ICONS))
    lines = [
        '/**',
        f' * Bootstrap Icons v{VERSION} (https://icons.getbootstrap.com/) — MIT, see LICENSE-bootstrap-icons.txt.',
        ' * Embedded as inline SVG path data: no font, no asset URL, no bundler inlining involved. The glyphs',
        ' * are part of the JavaScript bundle itself, so they render identically under file:// in every',
        ' * packaged build on every machine.',
        ' *',
        ' * GENERATED FILE — do not edit by hand. Regenerate with: python3 scripts/vendor-icons.py',
        ' */',
        '',
        "export type IconPath = { d: string; fillRule?: 'evenodd' | 'nonzero' }",
        '',
        'export const BOOTSTRAP_ICON_PATHS = {'
    ]
    entries = []
    for name in names:
        svg = fetch(name)
        assert 'viewBox="0 0 16 16"' in svg, name
        paths = []
        for match in re.finditer(r'<path\s+([^>]*?)/>', svg):
            attrs = dict(re.findall(r'([a-z-]+)="([^"]*)"', match.group(1)))
            assert set(attrs) <= {'d', 'fill-rule'}, (name, attrs)
            extra = f", fillRule: '{attrs['fill-rule']}'" if 'fill-rule' in attrs else ''
            paths.append("    { d: '" + attrs['d'].replace("'", "\\'") + "'" + extra + ' }')
        assert paths, f'{name}: no <path> elements'
        assert not re.search(r'<(circle|rect|polygon|line|g)\b', svg), f'{name}: unsupported shape'
        entries.append(f"  '{name}': [\n" + ',\n'.join(paths) + '\n  ]')
        print(name, len(paths), 'paths')
    lines.append(',\n'.join(entries))
    lines += ['} satisfies Record<string, readonly IconPath[]>', '']
    with open(OUT, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(lines))
    print('written', os.path.relpath(OUT, ROOT), len(names), 'icons')


if __name__ == '__main__':
    main()
