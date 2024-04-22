import { describe, expect, it } from 'vitest';

import { getTooltipScale, getXYZCoordinates } from './helpers';

describe('getTooltipScale', () => {
  it('returns correct value when distance is equal to minDistance', () => {
    const scale = getTooltipScale(0, 0, 1);
    expect(scale).toBe(1);
  });

  it('returns correct value when distance is equal to maxDistance', () => {
    const scale = getTooltipScale(1, 0, 1);
    expect(scale).toBe(0.5);
  });

  it('returns correct value when minDistance < distance < maxDistance', () => {
    const scale = getTooltipScale(0.5, 0, 1);
    expect(scale).toBe(0.75);
  });

  it('returns correct value when minDistance is bigger than 0', () => {
    const scale = getTooltipScale(7, 5, 10);
    expect(scale).toBe(0.8);
  });

  it('returns correct value when minDistance is bigger than 0', () => {
    const scale = getTooltipScale(2, 4, 8);
    expect(scale).toBe(1);
  });

  it('returns correct value when minDistance is bigger than 0', () => {
    const scale = getTooltipScale(10, 4, 8);
    expect(scale).toBe(0.5);
  });

  it('expects error when minDistance is >= maxDistance', () => {
    expect(() => getTooltipScale(0.5, 1, 0)).toThrowError();
  });

  it('expects error when all arguments values are equal', () => {
    expect(() => getTooltipScale(1, 1, 1)).toThrowError();
  });
});

describe('getXYZCoordinates', () => {
  it('', () => {
    const coordinates = getXYZCoordinates(0, 0, 0, 0);
    expect(coordinates).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('', () => {
    const coordinates = getXYZCoordinates(20, 50, 10, 0);
    expect(coordinates.x).toBeCloseTo(7.2, 2);
    expect(coordinates.y).toBeCloseTo(3.42, 2);
    expect(coordinates.z).toBeCloseTo(6.04, 2);
  });
});
