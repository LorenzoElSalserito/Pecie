#!/usr/bin/env python3
"""
Regenerate apps/desktop/src/renderer/src/components/ToolbarIcons.tsx from Bootstrap Icons.

    python3 scripts/vendor-toolbar-icons.py [--version 1.13.1]

Downloads the SVG sources for the names listed in ICONS from the twbs/icons repository,
extracts their <path> data and writes them as inline JSX. The app never loads SVG files
or icon fonts for the toolbar: the glyphs are part of the JavaScript bundle.
"""
import os, re, sys, urllib.request

ICONS = ['123', 'bar-chart-line', 'blockquote-left', 'card-image', 'chat-left-quote', 'check2-square', 'code',
         'code-square', 'diagram-2', 'diagram-3', 'highlighter', 'link-45deg', 'list-ol', 'list-ul', 'subscript',
         'superscript', 'table', 'type-bold', 'type-h2', 'type-italic', 'type-strikethrough', 'type-underline']
VERSION = sys.argv[sys.argv.index('--version') + 1] if '--version' in sys.argv else '1.13.1'
OUT = os.path.join(os.path.dirname(__file__), '..', 'apps/desktop/src/renderer/src/components/ToolbarIcons.tsx')


def fetch(name):
    url = f'https://raw.githubusercontent.com/twbs/icons/v{VERSION}/icons/{name}.svg'
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode('utf-8')


lines = [
    '/**',
    f' * Editor toolbar icons — Bootstrap Icons v{VERSION} (MIT), embedded as inline SVG path data.',
    ' * No font, no asset URL, no bundler inlining involved: the glyphs are part of the JavaScript',
    ' * bundle itself, so they render identically under file:// in every packaged build.',
    ' * Regenerate with scripts/vendor-toolbar-icons.py if the icon set changes.',
    ' */', '', 'export type ToolbarIconName =']
lines += [f"  | '{name}'" for name in ICONS]
lines += ['', "type IconPath = { d: string; fillRule?: 'evenodd' | 'nonzero' }", '',
          'const TOOLBAR_ICON_PATHS: Record<ToolbarIconName, readonly IconPath[]> = {']
entries = []
for name in ICONS:
    svg = fetch(name)
    assert 'viewBox="0 0 16 16"' in svg, name
    paths = []
    for match in re.finditer(r'<path\s+([^>]*?)/>', svg):
        attrs = dict(re.findall(r'([a-z-]+)="([^"]*)"', match.group(1)))
        assert set(attrs) <= {'d', 'fill-rule'}, (name, attrs)
        extra = f", fillRule: '{attrs['fill-rule']}'" if 'fill-rule' in attrs else ''
        paths.append("    { d: '" + attrs['d'].replace("'", "\\'") + "'" + extra + ' }')
    entries.append(f"  '{name}': [\n" + ',\n'.join(paths) + '\n  ]')
    print(name, len(paths), 'paths')
lines.append(',\n'.join(entries))
lines += ['}', '', '''export function ToolbarIcon({ name, className }: { name: ToolbarIconName; className?: string }): React.JSX.Element {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" focusable="false" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      {TOOLBAR_ICON_PATHS[name].map((path, index) => (
        <path d={path.d} fillRule={path.fillRule} key={index} />
      ))}
    </svg>
  )
}
''']
with open(OUT, 'w') as handle:
    handle.write('\n'.join(lines))
print('written', os.path.relpath(OUT))
