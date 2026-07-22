// PIXEL-ART ICON SET — chunky bitmap glyphs drawn as a grid of square cells.
// Built for the pixelated bottom nav: each icon is an 11×11 bitmap ('X' = a
// filled pixel). Rendered with plain Views so any hex color works (pink for
// the active tab, ink for the rest) and it stays crisp at any size — no PNG,
// no network, no tint hacks.
import React from 'react';
import { View } from 'react-native';

export type PixelIconName = 'home' | 'reel' | 'category' | 'bag';

// Each map is a list of equal-length rows. 'X' → filled pixel, anything else → gap.
const MAPS: Record<PixelIconName, string[]> = {
  // House — solid roof + body with a doorway notch.
  home: [
    '.....X.....',
    '....XXX....',
    '...XXXXX...',
    '..XXXXXXX..',
    '.XXXXXXXXX.',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXX..XXXX.',
    '.XXX..XXXX.',
  ],
  // Reel — video frame with a right-pointing play triangle.
  reel: [
    'XXXXXXXXXXX',
    'X.........X',
    'X..X......X',
    'X..XX.....X',
    'X..XXX....X',
    'X..XXXX...X',
    'X..XXX....X',
    'X..XX.....X',
    'X..X......X',
    'X.........X',
    'XXXXXXXXXXX',
  ],
  // Category — 2×2 grid of blocks (menu / departments).
  category: [
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    '...........',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
    'XXXXX.XXXXX',
  ],
  // Bag — handle arch over a solid shopping bag body.
  bag: [
    '...XXXXX...',
    '..XX...XX..',
    '..X.....X..',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
    '.XXXXXXXXX.',
  ],
};

export function PixelIcon({ name, size = 22, color = '#000' }: {
  name: PixelIconName;
  size?: number;
  color?: string;
}) {
  const rows = MAPS[name];
  const cols = rows[0].length;
  // Fractional cell so the glyph hits the exact target size (whole-pixel
  // flooring made it snap in ~11px jumps, which felt either tiny or huge).
  const cell = size / cols;
  return (
    <View style={{ width: cell * cols, height: cell * rows.length }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.split('').map((c, i) => (
            <View
              key={i}
              style={{
                width: cell,
                height: cell,
                backgroundColor: c === 'X' ? color : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
