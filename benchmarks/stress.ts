import * as THREE from 'three';

import BarGlob3d from '../src/lib/BarGlob3d';
import Tooltip from '../src/lib/TooltipElement';

const SCENARIOS = {
  small: 100,
  medium: 500,
  large: 1000,
} as const;

const SCENARIO_NAMES = Object.keys(SCENARIOS) as Scenario[];

type Scenario = keyof typeof SCENARIOS;

type DurationStats = {
  calls: number;
  totalMs: number;
  maxMs: number;
};

type ScenarioReport = ReturnType<typeof buildScenarioReport> & {
  cleanup: {
    tooltipDomCount: number;
    canvasCount: number;
  };
};

declare global {
  interface Window {
    __GLOB3D_BENCHMARK__?: object;
    __GLOB3D_BENCHMARK_DONE__?: boolean;
  }
}

const PRE_INSTANCING_BASELINE = {
  capturedAt: '2026-09-04',
  barDrawCallRelationship: 'approximately 2N + 2',
  results: {
    small: {
      requestedDataPoints: 100,
      startupMs: 710.7,
      updateMeanMs: 15.2,
      fps: 47.23,
      drawCalls: 202,
      rendererGeometries: 502,
    },
    medium: {
      requestedDataPoints: 500,
      startupMs: 826.9,
      updateMeanMs: 64.06,
      fps: 15.11,
      drawCalls: 1002,
      rendererGeometries: 2502,
    },
    large: {
      requestedDataPoints: 1000,
      startupMs: 1161.5,
      updateMeanMs: 292.24,
      fps: 12.56,
      drawCalls: 2002,
      rendererGeometries: 5002,
    },
  },
};

const params = new URLSearchParams(window.location.search);
const requestedScenario = params.get('scenario') || 'medium';
const runAll = requestedScenario === 'all';
if (!runAll && !(requestedScenario in SCENARIOS)) {
  throw new Error(
    `Unknown scenario "${requestedScenario}". Use small, medium, large, or all.`
  );
}

const selectedScenarios: Scenario[] = runAll
  ? SCENARIO_NAMES
  : [requestedScenario as Scenario];
const maxDatumCount = Math.max(
  ...selectedScenarios.map((name) => SCENARIOS[name])
);
const dotRes = readIntegerParam(
  params.has('dotRes') ? 'dotRes' : 'hexRes',
  3,
  1,
  5
);
const sampleFrames = readIntegerParam('frames', 180, 30, 1200);
const updateRuns = readIntegerParam('updates', 5, 1, 20);
const settleFrames = readIntegerParam('settle', 30, 1, 300);
const tooltipLimit = readIntegerParam('tooltipLimit', 15, 0, maxDatumCount);
const root = requiredElement<HTMLElement>('globe');
const status = requiredElement<HTMLElement>('status');
const resultElement = requiredElement<HTMLElement>('result');

const measurements = {
  picking: createDurationStats(),
  tooltip: createDurationStats(),
};

instrumentPicking();
instrumentTooltips();
run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : error;
  status.textContent = 'Benchmark failed';
  status.dataset.status = 'failed';
  resultElement.textContent = String(message);
  window.__GLOB3D_BENCHMARK_DONE__ = true;
  throw error;
});

async function run() {
  const scenarioReports: Record<string, ScenarioReport> = {};
  for (const scenario of selectedScenarios) {
    scenarioReports[scenario] = await runScenario(scenario);
  }

  const report = runAll
    ? buildSuiteReport(scenarioReports as Record<Scenario, ScenarioReport>)
    : scenarioReports[selectedScenarios[0]];

  window.__GLOB3D_BENCHMARK__ = report;
  window.__GLOB3D_BENCHMARK_DONE__ = true;
  status.textContent = 'Benchmark complete';
  status.dataset.status = 'complete';
  resultElement.textContent = JSON.stringify(report, null, 2);
  console.info('GLOB3D_BENCHMARK_RESULT', report);
}

async function runScenario(scenario: Scenario) {
  const datumCount = SCENARIOS[scenario];
  status.textContent = `Building ${scenario} scenario (${datumCount} data points)…`;
  const data = createData(datumCount);
  const heapBeforeBytes = readHeapBytes();

  const constructionStarted = performance.now();
  const globe = new BarGlob3d(root, [], {
    dotRes,
    tooltipsLimit: tooltipLimit,
  });
  const constructionMs = performance.now() - constructionStarted;

  const updateTimesMs: number[] = [];
  for (let index = 0; index < updateRuns; index += 1) {
    status.textContent = `Running ${scenario} update ${
      index + 1
    }/${updateRuns}…`;
    const started = performance.now();
    globe.onUpdate(data);
    updateTimesMs.push(performance.now() - started);
    await nextFrame();
  }

  await waitForFrames(settleFrames);
  const geometriesAfterUpdates = globe.getRendererInfo().memory.geometries;
  resetFrameMeasurements();
  status.textContent = `Sampling ${sampleFrames} animation frames for ${scenario}…`;
  const frameTimesMs = await sampleFrameTimes(sampleFrames);
  const heapAfterBytes = readHeapBytes();
  const tooltipDomCount = root.querySelectorAll('[data-id="tooltip"]').length;
  const rendererInfo = globe.getRendererInfo();
  const instancing = collectInstancingStats(globe);
  const canvas = root.querySelector('canvas');

  const report = buildScenarioReport({
    scenario,
    datumCount,
    constructionMs,
    updateTimesMs,
    frameTimesMs,
    rendererInfo,
    instancing,
    geometriesAfterUpdates,
    canvas,
    tooltipDomCount,
    heapBeforeBytes,
    heapAfterBytes,
  });

  globe.destroy();
  const cleanup = {
    tooltipDomCount: root.querySelectorAll('[data-id="tooltip"]').length,
    canvasCount: root.querySelectorAll('canvas').length,
  };
  resetFrameMeasurements();
  return { ...report, cleanup };
}

function buildScenarioReport({
  scenario,
  datumCount,
  constructionMs,
  updateTimesMs,
  frameTimesMs,
  rendererInfo,
  instancing,
  geometriesAfterUpdates,
  canvas,
  tooltipDomCount,
  heapBeforeBytes,
  heapAfterBytes,
}: {
  scenario: Scenario;
  datumCount: number;
  constructionMs: number;
  updateTimesMs: number[];
  frameTimesMs: number[];
  rendererInfo: ReturnType<BarGlob3d['getRendererInfo']>;
  instancing: ReturnType<typeof collectInstancingStats>;
  geometriesAfterUpdates: number;
  canvas: HTMLCanvasElement | null;
  tooltipDomCount: number;
  heapBeforeBytes: number | null;
  heapAfterBytes: number | null;
}) {
  return {
    schemaVersion: 2,
    renderer: 'instanced' as const,
    capturedAt: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      viewport: {
        width: root.clientWidth,
        height: root.clientHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      heapMeasurementAvailable:
        heapBeforeBytes !== null && heapAfterBytes !== null,
    },
    scenario: {
      name: scenario,
      requestedDataPoints: datumCount,
      aggregatedBars: instancing.barInstances,
      dotRes,
      tooltipLimit,
      updateRuns,
      sampleFrames,
    },
    startup: {
      constructionMs: round(constructionMs),
    },
    updates: {
      samplesMs: updateTimesMs.map(round),
      meanMs: round(mean(updateTimesMs)),
      maxMs: round(Math.max(...updateTimesMs)),
    },
    rendering: {
      fps: round(1000 / mean(frameTimesMs)),
      frameTimeMs: summarize(frameTimesMs),
      drawCalls: rendererInfo.render.calls,
      triangles: rendererInfo.render.triangles,
      lines: rendererInfo.render.lines,
      points: rendererInfo.render.points,
      instancing,
      resources: {
        ...rendererInfo.memory,
        geometriesAfterUpdates,
        geometriesStable:
          rendererInfo.memory.geometries === geometriesAfterUpdates,
      },
      canvasPixels: canvas
        ? { width: canvas.clientWidth, height: canvas.clientHeight }
        : null,
    },
    picking: finalizeDurationStats(measurements.picking),
    tooltips: {
      update: finalizeDurationStats(measurements.tooltip),
      domCount: tooltipDomCount,
    },
    memory: {
      heapBeforeBytes,
      heapAfterBytes,
      heapGrowthBytes:
        heapBeforeBytes !== null && heapAfterBytes !== null
          ? heapAfterBytes - heapBeforeBytes
          : null,
    },
  };
}

function buildSuiteReport(scenarioReports: Record<Scenario, ScenarioReport>) {
  const first = scenarioReports[SCENARIO_NAMES[0]];
  return {
    schemaVersion: 2,
    renderer: 'instanced' as const,
    capturedAt: new Date().toISOString(),
    command: 'npm run benchmark:stress',
    environment: {
      runtime: first.environment.userAgent,
      viewport: first.environment.viewport,
      dotRes,
      updateRuns,
      sampleFrames,
      tooltipLimit,
    },
    preInstancingBaseline: PRE_INSTANCING_BASELINE,
    results: Object.fromEntries(
      SCENARIO_NAMES.map((name) => [name, compactResult(scenarioReports[name])])
    ),
    notes: [
      'Land dots and bars are InstancedMesh draws, so draw calls stay roughly constant as bar count grows.',
      'Transparent DoubleSide materials can still issue two passes, so the measured call count is a small constant rather than 1.',
      'Repeated onUpdate disposes replaced bar GPU resources; geometriesAfterUpdates should match the final geometry count.',
      'destroy() cancels the animation loop and removes the canvas and tooltip DOM before the next scenario.',
      'Heap values are raw performance.memory snapshots and can decrease when garbage collection occurs.',
      'scenario=all runs in one page, so heap figures are sequential across small, medium, and large.',
    ],
  };
}

function compactResult(report: ScenarioReport) {
  return {
    requestedDataPoints: report.scenario.requestedDataPoints,
    aggregatedBars: report.scenario.aggregatedBars,
    startupMs: report.startup.constructionMs,
    updateMeanMs: report.updates.meanMs,
    updateMaxMs: report.updates.maxMs,
    fps: report.rendering.fps,
    frameTimeMeanMs: report.rendering.frameTimeMs.mean,
    frameTimeP95Ms: report.rendering.frameTimeMs.p95,
    drawCalls: report.rendering.drawCalls,
    triangles: report.rendering.triangles,
    meshes: report.rendering.instancing.meshes,
    instancedMeshes: report.rendering.instancing.instancedMeshes,
    landInstances: report.rendering.instancing.landInstances,
    barInstances: report.rendering.instancing.barInstances,
    pickingTotalMs: report.picking.totalMs,
    pickingMeanPerFrameMs: report.picking.meanMs,
    tooltipTotalMs: report.tooltips.update.totalMs,
    tooltipMeanPerItemMs: report.tooltips.update.meanMs,
    tooltipDomCount: report.tooltips.domCount,
    heapBeforeBytes: report.memory.heapBeforeBytes,
    heapAfterBytes: report.memory.heapAfterBytes,
    heapGrowthBytes: report.memory.heapGrowthBytes,
    rendererGeometries: report.rendering.resources.geometries,
    rendererGeometriesAfterUpdates:
      report.rendering.resources.geometriesAfterUpdates,
    rendererTextures: report.rendering.resources.textures,
    cleanup: report.cleanup,
  };
}

function collectInstancingStats(globe: BarGlob3d) {
  let meshes = 0;
  let instancedMeshes = 0;
  let instances = 0;
  let barInstances = 0;
  const landInstances = globe.dotGlobe?.count ?? 0;

  globe.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes += 1;
    if (!(object instanceof THREE.InstancedMesh)) return;
    instancedMeshes += 1;
    instances += object.count;
    if (object !== globe.dotGlobe) barInstances += object.count;
  });

  return { meshes, instancedMeshes, instances, landInstances, barInstances };
}

function instrumentPicking() {
  const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
  THREE.Raycaster.prototype.intersectObjects = function <
    TIntersected extends THREE.Object3D
  >(
    objects: THREE.Object3D[],
    recursive = true,
    intersects: THREE.Intersection<TIntersected>[] = []
  ): THREE.Intersection<TIntersected>[] {
    const started = performance.now();
    const value = originalIntersectObjects.apply(this, [
      objects,
      recursive,
      intersects,
    ]) as THREE.Intersection<TIntersected>[];
    recordDuration(measurements.picking, performance.now() - started);
    return value;
  };
}

function instrumentTooltips() {
  const originalHandleCameraUpdate = Tooltip.prototype.handleCameraUpdate;
  Tooltip.prototype.handleCameraUpdate = function (...args) {
    const started = performance.now();
    const value = originalHandleCameraUpdate.apply(this, args);
    recordDuration(measurements.tooltip, performance.now() - started);
    return value;
  };
}

function createData(count: number): GlobeData[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    return {
      country: `Country ${index % 50}`,
      city: `Location ${index}`,
      coordinates: {
        lat: Math.asin(y) * (180 / Math.PI),
        lon: Math.atan2(z, x) * (180 / Math.PI),
      },
      value: ((index * 7919) % 100000) + 1,
    };
  });
}

function createDurationStats(): DurationStats {
  return { calls: 0, totalMs: 0, maxMs: 0 };
}

function recordDuration(stats: DurationStats, durationMs: number) {
  stats.calls += 1;
  stats.totalMs += durationMs;
  stats.maxMs = Math.max(stats.maxMs, durationMs);
}

function resetFrameMeasurements() {
  for (const stats of [measurements.picking, measurements.tooltip]) {
    stats.calls = 0;
    stats.totalMs = 0;
    stats.maxMs = 0;
  }
}

function finalizeDurationStats(stats: DurationStats) {
  return {
    calls: stats.calls,
    totalMs: round(stats.totalMs),
    meanMs: round(stats.calls ? stats.totalMs / stats.calls : 0),
    maxMs: round(stats.maxMs),
  };
}

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: round(mean(values)),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(Math.max(...values)),
  };
}

function percentile(sortedValues: number[], fraction: number) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(sortedValues.length * fraction)
  );
  return sortedValues[index];
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function readHeapBytes(): number | null {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }
  ).memory;
  return memory?.usedJSHeapSize ?? null;
}

function readIntegerParam(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const rawValue = params.get(name);
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `"${name}" must be an integer between ${minimum} and ${maximum}.`
    );
  }
  return value;
}

function requiredElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} element.`);
  return element as T;
}

function nextFrame() {
  return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

async function waitForFrames(count: number) {
  for (let index = 0; index < count; index += 1) await nextFrame();
}

function sampleFrameTimes(count: number) {
  return new Promise<number[]>((resolve) => {
    const times: number[] = [];
    let previous = performance.now();
    const sample = (now: number) => {
      times.push(now - previous);
      previous = now;
      if (times.length >= count) resolve(times);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
