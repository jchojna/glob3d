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

An [npm package](https://www.npmjs.com/package/glob3d) for creating interactive 3D globes. Built with TypeScript and Three.js, Glob3d allows you to customize many aspects of the globe appearance and visualize geographic data in an engaging way.

- [Repo](https://github.com/jchojna/glob3d)
- [Demo](https://jchojna.github.io/glob3d-app/)
- [NPM](https://www.npmjs.com/package/glob3d)
- [My website](https://jakubchojna.pl/)

## Technologies

- Typescript
- [Three.js](https://threejs.org/)
- [h3-js](https://github.com/uber/h3-js)

## Features

- creating a 3D globe with hexagonal tiles representing the land areas
- creating a 3D globe with hexagonal bars, where the height and location of each bar is determined by the provided data
- customizing the appearance of the globe, including the color of the land, water, hexagonal tiles, tooltips, etc.
- ability to rotate and pan the camera around the globe
- tooltips with information about each hexagonal prism, with size adjusted to the distance from the camera
- specifying the number of tooltips to display, starting from the ones closest to the camera
- highlighting the hexagonal prisms and tooltip on hover or click

## Installation

```bash
npm install glob3d
```

## Usage

### Import

#### ES6 usage:

```js
import { BarGlob3d, Glob3d } from 'glob3d';
```

### 1. Creating a globe

To create a simple globe with hexagonal tiles and default options, use the following code:

```js
new Glob3d(container, options);
```

- **`container`:** A DOM element where the globe will be rendered.
- **`options`:** (optional) An object with the following properties:
  - **`globeColor`:** The color of the globe (water areas, gaps between hexagons).
  - **`globeOpacity`:** The opacity of the globe, value between 0 and 1.
  - **`globeRadius`:** The radius of the globe.
  - **`hexPadding`:** The hexagon's padding, value between 0 and 1.
  - **`hexRes`:** The resolution of hexagons, integer between 1 and 5.

### 2. Creating a globe with hexagonal prisms

To create a globe with hexagonal prisms, use the following code:

```js
new BarGlob3d(container, data, options);
```

- **`container`:** A DOM element where the globe will be rendered.
- **`data`:** An array of objects, each representing a hexagonal prism. Each object should have the following properties:
  - **`coordinates`:** An object with properties:
    - **`lon`:** The longitude of the vertex.
    - **`lat`:** The latitude of the vertex.
  - **`value`:** The value determining the height of the prism.
  - **`country`:** (optional) The name of the country belonging to the prism.
  - **`city`:** (optional) The name of the city belonging to the prism.
- **`options`:** (optional) An object with the following properties:
  - ... the options for the `Glob3d` class
  - **`barColor`** The color of the hexagonal prisms.
  - **`barOpacity`** The opacity of the hexagonal prisms, value between 0 and 1.
  - **`barActiveColor`** The color of the hexagonal prisms when hovered or clicked.
  - **`barActiveOpacity`** The opacity of the hexagonal prisms when hovered or clicked, value between 0 and 1.
  - **`highestBar`** The height of the highest hexagonal prism in relation to the globe diameter, value between 0 and 1.
  - **`tooltipActiveBackgroundColor`** The background color of the tooltip when hovered or clicked.
  - **`tooltipActiveTextColor`** The text color of the tooltip when hovered or clicked.
  - **`tooltipsLimit`** The number of tooltips to display, starting from the ones closest to the camera.
  - **`valueSuffix`** The suffix added to the value displayed in the tooltip.
