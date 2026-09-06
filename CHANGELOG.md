# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-09-07

Performance and rendering rewrite versus [0.9.1](https://www.npmjs.com/package/glob3d/v/0.9.1). npm itself only shows the README and a version list; this file (and GitHub Releases, if you publish one) is the changelog.

### Breaking

- Land is instanced circular cells, not per-cell polygon tiles. Land options are `landCellRes` and `landCellPadding`.
- `globeOpacity` and `setGlobeOpacity()` are removed.
- `landCellOpacity` is removed. Land cells stay fully opaque except during loading/error fade.
- `barOpacity` and `barActiveOpacity` are removed. Bars are fully opaque; hover and click use `barActiveColor` only.
- `tooltipActiveBackgroundColor` and `tooltipActiveTextColor` are removed. Tooltip chrome is a fixed frosted-glass style; the value uses `barActiveColor` / `setBarActiveColor()`.
- `setActiveColor()` is renamed to `setBarActiveColor()`.
- `fadeOutLandCells()` / `fadeInLandCells()` fade the land mesh.
- Peer dependency `three-conic-polygon-geometry` is no longer required.

### Added

- `autoRotate` constructor option (default `true`), matching `setAutoRotate()`.
- Exported types: `GlobeOptions`, `BarGlobeOptions`, and `GlobeData`.
- `destroy()` tears down the animation loop, listeners, tooltip DOM, and GPU resources.
- Instanced land and bar rendering: draw calls stay roughly constant as the dataset grows.
- Virtualized tooltips: DOM is limited to `tooltipsLimit` plus the hovered or clicked bar.
- Analytic globe occlusion for tooltips (no per-tooltip raycast).
- Camera-depth bar tinting toward `globeColor`.
- Browser stress benchmark (`npm run benchmark:stress`).

### Changed

- One dirty-gated frame loop drives controls, picking, tooltips, and render-on-demand.
- Repeated `onUpdate()` disposes replaced bar geometries and materials.
- Default land padding is `0.3` (`landCellPadding`); it was `0.2` in 0.9.1.
