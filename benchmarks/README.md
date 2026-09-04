# Rendering stress benchmark

This browser benchmark supplies deterministic small, medium, and large datasets
and records the main costs targeted by the rendering performance work.

## Run it

```bash
npm run benchmark:stress
```

Open one scenario per fresh page load:

- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=small`
- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=medium`
- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=large`

Defaults are 100, 500, and 1,000 input data points respectively, with five
updates and 180 sampled frames. Query parameters make runs repeatable:

- `scenario=medium`: select the small, medium, or large dataset.
- `hexRes=3`: set land and bar H3 resolution from 1 to 5.
- `updates=5`: set the number of repeated `onUpdate` samples.
- `frames=180`: set the animation frames included in the report.
- `settle=30`: set the warm-up frames discarded before sampling.
- `tooltipLimit=15`: set the maximum visible tooltips.

The completed JSON report is displayed beside the globe, logged under
`GLOB3D_BENCHMARK_RESULT`, and exposed as
`window.__GLOB3D_BENCHMARK__`. Automation can wait until
`window.__GLOB3D_BENCHMARK_DONE__ === true`.

The checked-in `baseline.json` records the initial small, medium, and large
results, the browser/viewport configuration, and the earlier local reference
measurements from the performance investigation.

## Measurements

- Startup time covers globe construction and synchronous land geometry.
- Update samples cover bar aggregation/geometry and tooltip DOM creation.
- Frame time and FPS cover the browser animation cadence.
- `renderer.info` supplies draw calls, primitive counts, and GPU resource counts.
- Picking time wraps the per-frame bar/globe raycast.
- Tooltip time wraps projection, position, and globe-occlusion work.
- Tooltip DOM count catches accidental detached/duplicate element retention.
- Heap before/after repeated updates is reported where Chromium exposes
  `performance.memory`.

Use the same browser build, viewport, device pixel ratio, power state, and query
parameters when comparing changes. Renderer and heap figures are especially
hardware/runtime dependent. Run each scenario in a fresh tab because the
current library does not yet expose lifecycle cleanup for its animation loops.
