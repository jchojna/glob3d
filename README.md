# Glob3d

<div>
  <a href="https://www.npmjs.com/package/glob3d">
    <img src="https://img.shields.io/npm/v/glob3d.svg" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/glob3d">
    <img src="https://img.shields.io/npm/dt/glob3d.svg" alt="npm downloads" />
  </a>
</div>

<div style="display: flex; gap: 10px">
  <a href="https://jchojna.github.io/glob3d-app/">
    <img src="https://jchojna.github.io/glob3d-app/screenshots/globe_1.jpg" alt="Globe 1" />
  </a>
  <a href="https://jchojna.github.io/glob3d-app/">
    <img src="https://jchojna.github.io/glob3d-app/screenshots/globe_2.jpg" alt="Globe 2" />
  </a>
</div>

An [npm package](https://www.npmjs.com/package/glob3d) for creating interactive 3D globes. Built with TypeScript and Three.js, Glob3d lets you customize the globe appearance and visualize geographic data as bars on a rotating globe.

- [Repo](https://github.com/jchojna/glob3d)
- [Demo](https://jchojna.github.io/glob3d-app/)
- [NPM](https://www.npmjs.com/package/glob3d)
- [Changelog](https://github.com/jchojna/glob3d/blob/main/CHANGELOG.md)
- [My website](https://jchojna.github.io/)

## Technologies

- Typescript
- [Three.js](https://threejs.org/)
- [h3-js](https://github.com/uber/h3-js)
- [world-map-geojson](https://www.npmjs.com/package/world-map-geojson)

## Features

- 3D globe with instanced land cells (H3 cells rendered as circles)
- data-driven bars whose height and location come from the provided dataset
- customizable globe and bar colors
- rotate and pan the camera around the globe
- tooltips that scale with camera distance and stay limited to the nearest items (plus the hovered or clicked bar)
- highlight on hover or click
- `destroy()` to tear down the renderer, listeners, and tooltip DOM

## Installation

```bash
npm install glob3d
```

Peer dependencies: `three`, `h3-js`, and `world-map-geojson`. `three-conic-polygon-geometry` is no longer required.

## Usage

### Import

#### ES6 usage:

```js
import { BarGlob3d, Glob3d } from 'glob3d';
```

```ts
import { BarGlob3d, Glob3d } from 'glob3d';
import type { BarGlobeOptions, GlobeData, GlobeOptions } from 'glob3d';
```

### 1. Creating a globe

To create a globe with land cells and default options:

```js
new Glob3d(container, options);
```

- **`container`:** A DOM element where the globe will be rendered.
- **`options`:** (optional) An object with the following properties:
  - **`globeColor`:** The color of the globe (water / surface). Default `'#1a166e'`.
  - **`globeRadius`:** The radius of the globe. Default `100`.
  - **`landCellPadding`:** The land-cell padding, value between 0 and 1. Default `0.3`.
  - **`landCellRes`:** The H3 resolution of land cells, integer between 1 and 5. Default `3`.
  - **`autoRotate`:** Whether the camera auto-rotates. Default `true`.

`globeOpacity`, `landCellOpacity`, `barOpacity`, and `barActiveOpacity` from earlier versions are gone. See the [changelog](https://github.com/jchojna/glob3d/blob/main/CHANGELOG.md) for the land-cell option names.

### 2. Creating a globe with bars

To create a globe with data bars:

```js
new BarGlob3d(container, data, options);
```

- **`container`:** A DOM element where the globe will be rendered.
- **`data`:** An array of objects, each representing a bar. Each object should have the following properties:
  - **`coordinates`:** An object with properties:
    - **`lon`:** The longitude.
    - **`lat`:** The latitude.
  - **`value`:** The value determining the height of the bar.
  - **`country`:** The name of the country belonging to the bar.
  - **`city`:** The name of the city belonging to the bar.
- **`options`:** (optional) An object with the following properties:
  - ... the options for the `Glob3d` class
  - **`barColor`:** The color of bars closest to the camera (near color). Default `'#dd176d'`.
  - **`barActiveColor`:** The color of the hovered or clicked bar, and of the tooltip value. Default `'#dd176d'`.
  - **`highestBar`:** The height of the highest bar in relation to the globe diameter, value between 0 and 1. Default `0.5`.
  - **`tooltipsLimit`:** The number of tooltips to display, starting from the ones closest to the camera. Default `15`.
  - **`tooltipValueSuffix`:** The suffix added to the value displayed in the tooltip. Default `''`.

### 3. Updating, loading, and cleanup

```js
const globe = new BarGlob3d(container, [], options);

globe.onLoading();
globe.onUpdate(data);
globe.setGlobeColor('#1a166e');
globe.setBarColor('#dd176d');
globe.setBarActiveColor('#dd176d');
globe.setAutoRotate(true);

// when the globe is no longer needed
globe.destroy();
```

- **`onLoading()`** / **`onError()`:** Show the loader or error state and hide the current bars.
- **`onUpdate(data)`:** Replace the bars and tooltips with a new dataset. Safe to call repeatedly.
- **`setGlobeColor(color)`:** Recolor the globe. On `BarGlob3d`, also updates the far-bar tint and inactive tooltip backgrounds.
- **`setBarColor(color)`:** Recolor bars closest to the camera (near color).
- **`setBarActiveColor(color)`:** Recolor the hovered/clicked bar and the tooltip value.
- **`setAutoRotate(autoRotate)`:** Toggle camera auto-rotation. Same as the `autoRotate` constructor option.
- **`destroy()`:** Cancel the animation loop, remove listeners and tooltip DOM, and dispose GPU resources.

## What's new in 1.0.0

Compared with 0.9.1: land is instanced circular cells instead of per-cell polygon tiles, bars are one instanced mesh, tooltips are virtualized, and `destroy()` is available. Draw calls stay constant as the dataset grows. See the [changelog](https://github.com/jchojna/glob3d/blob/main/CHANGELOG.md) for the full list, including option renames (`setBarActiveColor`), removed opacities, the `autoRotate` option, and exported TypeScript types (`GlobeOptions`, `BarGlobeOptions`, `GlobeData`).
