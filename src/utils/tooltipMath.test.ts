import { describe, expect, it } from 'vitest';

import {
  getValueRanks,
  isPointOccludedBySphere,
  selectVisibleTooltipIndices,
} from './tooltipMath';

describe('getValueRanks', () => {
  it('ranks values in descending order', () => {
    expect(getValueRanks([1, 2, 3])).toEqual([3, 2, 1]);
  });

  it('uses competition ranking for ties', () => {
    expect(getValueRanks([10, 8, 8, 5])).toEqual([1, 2, 2, 4]);
  });

  it('matches the previous per-item filter ranking', () => {
    const values = [4, 17, 17, 9, 1, 9];
    const expected = values.map(
      (value) => values.filter((other) => other > value).length + 1
    );
    expect(getValueRanks(values)).toEqual(expected);
  });

  it('returns an empty array for no values', () => {
    expect(getValueRanks([])).toEqual([]);
  });
});

describe('selectVisibleTooltipIndices', () => {
  it('keeps the closest items up to the limit', () => {
    const selection = selectVisibleTooltipIndices([40, 10, 30, 20], 2);

    expect(selection.items.map((item) => item.index)).toEqual([1, 3]);
    expect(selection.items.map((item) => item.order)).toEqual([0, 1]);
    expect(selection.items.every((item) => item.inLimit)).toBe(true);
    expect(selection.minDistance).toBe(10);
    expect(selection.maxDistance).toBe(20);
  });

  it('adds hovered and clicked items that are outside the limit', () => {
    const selection = selectVisibleTooltipIndices(
      [10, 20, 30, 40, 50],
      2,
      [4, 3]
    );

    expect(
      selection.items.map((item) => item.index).sort((a, b) => a - b)
    ).toEqual([0, 1, 3, 4]);
    expect(selection.items.find((item) => item.index === 4)?.inLimit).toBe(
      false
    );
    expect(selection.minDistance).toBe(10);
    expect(selection.maxDistance).toBe(20);
  });

  it('does not duplicate active items that are already in the limit', () => {
    const selection = selectVisibleTooltipIndices([8, 2, 5], 2, [1, 1]);

    expect(selection.items).toHaveLength(2);
    expect(selection.items.find((item) => item.index === 1)?.inLimit).toBe(
      true
    );
  });

  it('returns only extras when the limit is 0', () => {
    const selection = selectVisibleTooltipIndices([3, 1, 2], 0, [2, null]);

    expect(selection.items).toEqual([{ index: 2, order: -1, inLimit: false }]);
    expect(selection.minDistance).toBe(0);
    expect(selection.maxDistance).toBe(0);
  });
});

describe('isPointOccludedBySphere', () => {
  const camera = { x: 0, y: 0, z: 240 };
  const radius = 100;

  it('keeps a front-facing point visible', () => {
    expect(
      isPointOccludedBySphere({ x: 0, y: 0, z: 100 }, camera, radius)
    ).toBe(false);
  });

  it('hides a back-facing point', () => {
    expect(
      isPointOccludedBySphere({ x: 0, y: 0, z: -100 }, camera, radius)
    ).toBe(true);
  });

  it('keeps a front bar tip outside the globe visible', () => {
    expect(
      isPointOccludedBySphere({ x: 0, y: 0, z: 150 }, camera, radius)
    ).toBe(false);
  });

  it('hides a back bar tip whose segment passes through the globe', () => {
    expect(
      isPointOccludedBySphere({ x: 0, y: 0, z: -150 }, camera, radius)
    ).toBe(true);
  });

  it('does not treat the camera as occluded when it sits inside the sphere', () => {
    expect(
      isPointOccludedBySphere({ x: 0, y: 0, z: 90 }, { x: 0, y: 0, z: 10 }, 100)
    ).toBe(false);
  });
});
