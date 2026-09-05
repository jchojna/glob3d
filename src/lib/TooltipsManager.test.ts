import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import TooltipsManager from './TooltipsManager';

const createdRoots: HTMLElement[] = [];

afterEach(() => {
  createdRoots.splice(0).forEach((root) => root.remove());
});

function createManager(
  options: {
    tooltipsLimit?: number;
    globeRadius?: number;
    cameraPosition?: [number, number, number];
  } = {}
) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  createdRoots.push(root);

  const camera = new THREE.PerspectiveCamera(55, 1, 1, 1000);
  const [x, y, z] = options.cameraPosition ?? [0, 0, 240];
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const manager = new TooltipsManager(
    root,
    options.globeRadius ?? 100,
    camera,
    { width: 800, height: 600 },
    {
      tooltipActiveBackgroundColor: '#dd176d',
      tooltipActiveTextColor: '#fff',
      tooltipValueSuffix: 'people',
      tooltipsLimit: options.tooltipsLimit ?? 2,
    }
  );

  return { manager, root, camera };
}

function makeHex(
  id: string,
  lat: number,
  lng: number,
  value: number,
  offsetFromCenter = 150
): HexData {
  return {
    id,
    center: [lat, lng],
    city: `City ${id}`,
    coordinates: [lat, lng],
    country: `Country ${id}`,
    h3Index: id,
    offsetFromCenter,
    value,
    vertices: [],
  };
}

function tooltipIds(root: HTMLElement) {
  return [...root.querySelectorAll('[data-id="tooltip"]')].map((node) =>
    node.id.replace('tooltip-', '')
  );
}

function tooltipEl(root: HTMLElement, id: string) {
  return root.querySelector<HTMLElement>(`#tooltip-${id}`);
}

describe('TooltipsManager', () => {
  it('creates DOM only for the closest visible limit', () => {
    const { manager, root } = createManager({ tooltipsLimit: 2 });
    manager.createTooltips([
      makeHex('front-a', 0, 0, 10),
      makeHex('front-b', 10, 10, 20),
      makeHex('front-c', -10, -10, 30),
      makeHex('back', 0, 180, 40),
    ]);
    manager.update({ cameraChanged: true, layoutChanged: true });

    expect(manager.tooltipCount).toBe(2);
    expect(root.querySelectorAll('[data-id="tooltip"]')).toHaveLength(2);
    expect(manager.models).toHaveLength(4);
    expect(getValueRanksFromModels(manager)).toEqual([4, 3, 2, 1]);
  });

  it('keeps hovered and clicked items visible even when they are outside the limit', () => {
    const { manager, root } = createManager({ tooltipsLimit: 1 });
    const data = [
      makeHex('near', 0, 0, 10),
      makeHex('mid', 20, 20, 20),
      makeHex('far', -30, -40, 30),
    ];
    manager.createTooltips(data);
    manager.update({ cameraChanged: true, layoutChanged: true });

    const initiallyVisible = tooltipIds(root);
    expect(initiallyVisible).toHaveLength(1);
    const hiddenId = data
      .map((hex) => hex.id)
      .find((id) => !initiallyVisible.includes(id));
    expect(hiddenId).toBeTruthy();

    manager.hoveredHexId = hiddenId ?? null;
    manager.update({ cameraChanged: false, layoutChanged: false });

    expect(tooltipIds(root)).toEqual(
      expect.arrayContaining([...initiallyVisible, hiddenId])
    );
    expect(
      tooltipEl(root, hiddenId as string)?.classList.contains(
        'glob3d-tooltip-active'
      )
    ).toBe(true);
    expect(
      tooltipEl(root, hiddenId as string)?.classList.contains(
        'glob3d-tooltip-visible'
      )
    ).toBe(true);

    manager.clickedHexId = initiallyVisible[0];
    manager.hoveredHexId = hiddenId ?? null;
    manager.update({ cameraChanged: false, layoutChanged: false });

    const clicked = tooltipEl(root, initiallyVisible[0]);
    const hovered = tooltipEl(root, hiddenId as string);
    expect(Number(clicked?.style.zIndex)).toBeGreaterThan(
      Number(hovered?.style.zIndex)
    );
  });

  it('hides in-limit tooltips that are behind the globe and keeps front ones visible', () => {
    const { manager, root } = createManager({ tooltipsLimit: 2 });
    manager.createTooltips([
      makeHex('front', 0, 0, 10),
      makeHex('back', 0, 180, 20),
    ]);
    manager.update({ cameraChanged: true, layoutChanged: true });

    expect(
      tooltipEl(root, 'front')?.classList.contains('glob3d-tooltip-visible')
    ).toBe(true);
    expect(
      tooltipEl(root, 'back')?.classList.contains('glob3d-tooltip-visible')
    ).toBe(false);
  });

  it('shows an occluded tooltip when it is hovered or clicked', () => {
    const { manager, root } = createManager({ tooltipsLimit: 2 });
    manager.createTooltips([
      makeHex('front', 0, 0, 10),
      makeHex('back', 0, 180, 20),
    ]);
    manager.update({ cameraChanged: true, layoutChanged: true });

    manager.clickedHexId = 'back';
    manager.update({ cameraChanged: false, layoutChanged: false });

    expect(
      tooltipEl(root, 'back')?.classList.contains('glob3d-tooltip-visible')
    ).toBe(true);
    expect(
      tooltipEl(root, 'back')?.classList.contains('glob3d-tooltip-active')
    ).toBe(true);
  });

  it('removes tooltip nodes on destroy and after repeated updates', () => {
    const { manager, root } = createManager({ tooltipsLimit: 3 });
    const first = [
      makeHex('a', 0, 0, 10),
      makeHex('b', 10, 10, 20),
      makeHex('c', -10, -10, 30),
    ];
    manager.createTooltips(first);
    manager.update({ cameraChanged: true, layoutChanged: true });
    expect(root.querySelectorAll('[data-id="tooltip"]').length).toBeGreaterThan(
      0
    );

    manager.removeTooltips();
    expect(root.querySelectorAll('[data-id="tooltip"]')).toHaveLength(0);
    expect(document.body.querySelectorAll('[data-id="tooltip"]')).toHaveLength(
      0
    );

    manager.createTooltips(first);
    manager.update({ cameraChanged: true, layoutChanged: true });
    manager.destroy();

    expect(root.querySelectorAll('[data-id="tooltip"]')).toHaveLength(0);
    expect(root.querySelector('[data-id="tooltip"]')).toBeNull();
    expect(manager.tooltipCount).toBe(0);
  });
});

function getValueRanksFromModels(manager: TooltipsManager) {
  return manager.models.map((model) => model.valueRank);
}
