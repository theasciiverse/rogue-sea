# Changes from upstream

This is the Asciiverse terminal edition of Rogue Sea, Ondřej Žára's game
for the 2021 Seven Day Roguelike Challenge, from github.com/ondras/rogue-sea
(the `upstream` remote; this branch, `asciiverse`, starts from its master
at `f4c357d`, 2026-07-29, with the full history). It is here by the
author's permission (`PERMISSION.md`).

**The game's own files are unchanged.** The game runs from its bundled
`index.js` (its TypeScript and Ondřej's fastiles library bundled by
esbuild, as its build makes it). Everything new is in `asciiverse/`, plus
this file and `PERMISSION.md`; README.md gets a note at the top on playing
it with av.

## How it works

Rogue Sea draws its sea with fastiles, a WebGL renderer of square tiles
from a CP437 bitmap font (REXPaint's), each tile a glyph with a foreground
and background colour from a palette.

- `asciiverse/rotty/`: rotty, our runtime for Ondřej's games (as in
  Goldfish, The Great Train Robbery and the others): the browser as far as
  they use it, today's parts included (`web.js`), with `fetch` answering
  from the game's files, a silent Web Audio, and WebGL left to the game's
  layout to stand in for.
- `asciiverse/game.js`: the page's layout:
  - a stand-in for WebGL 2 with just what fastiles calls: it takes the
    glyph and style of every tile, the tile and viewport sizes and the
    palette canvas as they are uploaded, and draws nothing itself;
  - each square tile becomes two terminal cells (a cell is twice as tall
    as wide), the glyph in the first, its colours over both, and lines,
    shading and blocks repeated in the second so they stay joined; CP437
    glyphs become their Unicode characters;
  - the map area counts as 20-pixel tiles, so at the game's largest zoom
    the sea fills the screen; zoomed out it shows the middle of the sea,
    around your ship;
  - the sidebar with the log and the status list, the tutorial notes on
    parchment, and the title page with its ship in sienna and white.
- `asciiverse/build.py`, `asciiverse/Makefile`: the page's script compiled
  with QuickJS-ng into one native binary of about 2 MB that needs nothing
  to run.

## Ours

- **Keys:** as in the browser. Ctrl+C or Ctrl+Q quits.
- **`--seed N`:** the game's random numbers seeded with N, so the seas are
  the same each time (the preview uses seed 3).
- **Session log:** `rogue-sea.log` in the state folder
  (`$XDG_STATE_HOME/rogue-sea`, `~/.local/state/rogue-sea`, Application
  Support on macOS, `%LOCALAPPDATA%` on Windows). `ROGUE_SEA_LOG=debug` (or
  `ROTTY_LOG=debug`) records every key and a snapshot each second.
- No sound: the music and the spatial sound effects (`audio/`) are not
  played. The page's fonts are not loaded, and the emoji after the status
  values are plain marks.

## Imported

- `asciiverse/quickjs/`: QuickJS-ng 0.17.0 as in our Candy Box 2 (one
  change in `quickjs-libc.c`: a signal interrupting `poll()` no longer ends
  the event loop), MIT.

## Packaging

- `.github/workflows/release.yml`: static Linux (musl, x86-64 and ARM64),
  macOS (x86-64 and ARM64) and Windows (x86-64, MinGW) archives plus
  SHA256SUMS, on tags `*-av.*`.
- `asciiverse/package.sh`: the archive (the program, PERMISSION.md,
  PATCHES.md, the licences of rotty and QuickJS-ng).
- `asciiverse/record-preview.sh`: the 100x30 catalog preview, with hub's
  castrec.py.
