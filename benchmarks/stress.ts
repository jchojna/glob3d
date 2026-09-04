import * as THREE from 'three';

import BarGlob3d from '../src/lib/BarGlob3d';
import Tooltip from '../src/lib/TooltipElement';

const SCENARIOS = {
  small: 100,
  medium: 500,
  large: 1000,
} as const;

type Scenario = keyof typeof SCENARIOS;

type DurationStats = {
  calls: number;
  totalMs: number;
  maxMs: number;
};

declare global {
  interface Window {
    __GLOB3D_BENCHMARK__?: object;
    __GLOB3D_BENCHMARK_DONE__?: boolean;
  }
}

const params = new URLSearchParams(window.location.search);
const requestedScenario = params.get('scenario') || 'medium';
if (!(requestedScenario in SCENARIOS)) {
  throw new Error(
    `Unknown scenario "${requestedScenario}". Use small, medium, or large.`
  );
}

const scenario = requestedScenario as Scenario;
const datumCount = SCENARIOS[scenario];
const hexRes = readIntegerParam('hexRes', 3, 1, 5);
const sampleFrames = readIntegerParam('frames', 180, 30, 1200);
const updateRuns = readIntegerParam('updates', 5, 1, 20);
const settleFrames = readIntegerParam('settle', 30, 1, 300);
const tooltipLimit = readIntegerParam('tooltipLimit', 15, 0, datumCount);
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
  status.textContent = `Building ${scenario} scenario (${datumCount} data points)…`;
  const data = createData(datumCount);
  const heapBeforeBytes = readHeapBytes();

  const constructionStarted = performance.now();
  const globe = new BarGlob3d(root, [], {
    hexRes,
    tooltipsLimit: tooltipLimit,
  });
  const constructionMs = performance.now() - constructionStarted;

  const updateTimesMs: number[] = [];
  for (let index = 0; index < updateRuns; index += 1) {
    status.textContent = `Running update ${index + 1}/${updateRuns}…`;
    const started = performance.now();
    globe.onUpdate(data);
    updateTimesMs.push(performance.now() - started);
    await nextFrame();
  }

  await waitForFrames(settleFrames);
  resetFrameMeasurements();
  status.textContent = `Sampling ${sampleFrames} animation frames…`;
  const frameTimesMs = await sampleFrameTimes(sampleFrames);
  const heapAfterBytes = readHeapBytes();
  const tooltipDomCount = root.querySelectorAll('[data-id="tooltip"]').length;
  const rendererInfo = globe.getRendererInfo();
  const canvas = root.querySelector('canvas');

  const report = {
    schemaVersion: 1,
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
      hexRes,
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
      resources: rendererInfo.memory,
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

  window.__GLOB3D_BENCHMARK__ = report;
  window.__GLOB3D_BENCHMARK_DONE__ = true;
  status.textContent = 'Benchmark complete';
  status.dataset.status = 'complete';
  resultElement.textContent = JSON.stringify(report, null, 2);
  console.info('GLOB3D_BENCHMARK_RESULT', report);
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
