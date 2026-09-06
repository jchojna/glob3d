# Rendering stress benchmark

This browser benchmark supplies deterministic small, medium, and large datasets
and records the main costs targeted by the rendering performance work. The
current library draws land cells and bars as `InstancedMesh` objects, so draw
calls stay roughly constant as the dataset grows.

## Run it

```bash
npm run benchmark:stress
```

Open one scenario per page, or run all three in one load (`destroy()` tears
down each globe before the next scenario starts):

- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=small`
- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=medium`
- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=large`
- `http://127.0.0.1:5173/benchmarks/stress.html?scenario=all`

Defaults are 100, 500, and 1,000 input data points respectively, with five
updates and 180 sampled frames. Query parameters make runs repeatable:

- `scenario=medium`: select the small, medium, or large dataset, or `all`.
- `landCellRes=3`: set land and bar H3 resolution from 1 to 5.
- `updates=5`: set the number of repeated `onUpdate` samples.
- `frames=180`: set the animation frames included in the report.
- `settle=30`: set the warm-up frames discarded before sampling.
- `tooltipLimit=15`: set the maximum visible tooltips.

The completed JSON report is displayed beside the globe, logged under
`GLOB3D_BENCHMARK_RESULT`, and exposed as
`window.__GLOB3D_BENCHMARK__`. Automation can wait until
`window.__GLOB3D_BENCHMARK_DONE__ === true`.

The checked-in `baseline.json` is a `scenario=all` report from the instanced
renderer. It also keeps a compact pre-instancing snapshot so draw-call and
geometry improvements stay visible.

## Measurements

- Startup time covers globe construction and synchronous land geometry.
- Update samples cover bar aggregation/geometry and tooltip DOM creation.
- Frame time and FPS cover the browser animation cadence.
- `renderer.info` supplies draw calls, primitive counts, and GPU resource counts.
- Scene traversal records mesh, `InstancedMesh`, land-instance, and bar-instance
  counts. After instancing, expect two instanced meshes (land cells + bars) plus the
  solid globe.
- Geometry counts after all updates and after frame sampling should match if
  replaced bar GPU resources were disposed.
- `destroy()` leftover tooltip and canvas counts confirm loop/DOM cleanup
  between scenarios.
- Picking time wraps the per-frame bar/globe raycast.
- Tooltip time wraps projection, position, and globe-occlusion work.
- Tooltip DOM count tracks the virtualized overlay: the visible limit plus any
  hovered or clicked extras, not every bar.
- Heap before/after repeated updates is reported where Chromium exposes
  `performance.memory`.

Use the same browser build, viewport, device pixel ratio, power state, and query
parameters when comparing changes. Renderer and heap figures are especially
hardware/runtime dependent. A `scenario=all` report shares one page lifetime, so
treat heap numbers as sequential rather than independent cold starts.
