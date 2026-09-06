import { describe, expect, it, vi } from 'vitest';

import multiPolygonFeature from '../mocks/multiPolygonFeature.json';
import polygonFeature from '../mocks/polygonFeature.json';

import {
  getH3Indexes,
  getLandCell,
  getNewGeoJson,
  getTooltip,
  getTooltipScale,
  getXYZCoordinates,
} from './helpers';

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

  it('expects error when minDistance is equal to maxDistance', () => {
    const scale = getTooltipScale(0.5, 1, 1);
    expect(scale).toBe(1);
  });

  it('expects error when minDistance is > maxDistance', () => {
    expect(() => getTooltipScale(0.5, 1, 0)).toThrowError();
  });
});

describe('getXYZCoordinates', () => {
  it('return absolute zero coordinates', () => {
    const coordinates = getXYZCoordinates(0, 0, 0, 0);
    expect(coordinates).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns correct x, y, z values', () => {
    const coordinates = getXYZCoordinates(20, 50, 10, 0);
    expect(coordinates.x).toBeCloseTo(7.2, 2);
    expect(coordinates.y).toBeCloseTo(3.42, 2);
    expect(coordinates.z).toBeCloseTo(6.04, 2);
  });
});

describe('getLandCell', () => {
  it('returns correct landCell', () => {
    const h3Index = '83309cfffffffff';
    const landCell = getLandCell(h3Index);
    // expect(landCell).toBe(null);

    expect(landCell).toHaveProperty('center');
    expect(landCell).toHaveProperty('h3Index');
    expect(landCell).toHaveProperty('vertices');

    expect(landCell.h3Index).toBe(h3Index);

    expect(landCell.center).toHaveLength(2);
    expect(landCell.center[0]).toBeGreaterThanOrEqual(-90);
    expect(landCell.center[0]).toBeLessThanOrEqual(90);
    expect(landCell.center[1]).toBeGreaterThanOrEqual(-180);
    expect(landCell.center[1]).toBeLessThanOrEqual(180);

    expect(landCell.vertices).toHaveLength(7);
    landCell.vertices.forEach((vertex) => {
      expect(vertex).toHaveLength(2);
      expect(vertex[0]).toBeGreaterThanOrEqual(-180);
      expect(vertex[0]).toBeLessThanOrEqual(180);
      expect(vertex[1]).toBeGreaterThanOrEqual(-90);
      expect(vertex[1]).toBeLessThanOrEqual(90);
    });
  });
});

describe('getNewGeoJson', () => {
  const mockLandCell = {
    center: [34.500094979532754, -118.44763026078893],
    city: 'Los Angeles',
    coordinates: [34.05223, -118.24368],
    country: 'United States',
    h3Index: '8329a1fffffffff',
    id: '',
    value: 3898747,
    vertices: [
      [-118.04038609770777, 33.94617247140065],
      [-118.83106703017793, 33.91826626424625],
      [-119.2405536967384, 34.468622114983724],
      [-118.85814740530697, 35.04976785327958],
      [-118.05943919190459, 35.079775914541045],
      [-117.65127589971758, 34.52652822808556],
      [-118.04038609770777, 33.94617247140065],
    ],
  };

  it('returns correct geoJson', () => {
    const result = getNewGeoJson(mockLandCell, 0.5);

    expect(result).toHaveLength(7);
    result.forEach(([lon, lat]) => {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    });
  });
});

describe('getH3Indexes', () => {
  it('returns correct h3Indexes of multiPolygonFeature', () => {
    const result = getH3Indexes(multiPolygonFeature, 1);
    expect(result).toStrictEqual([
      '8129bffffffffff',
      '8144fffffffffff',
      '8148bffffffffff',
      '8126bffffffffff',
      '81447ffffffffff',
      '81263ffffffffff',
      '81277ffffffffff',
      '8128bffffffffff',
      '8148fffffffffff',
      '8126fffffffffff',
      '812abffffffffff',
      '81267ffffffffff',
      '8127bffffffffff',
      '810c3ffffffffff',
      '810d7ffffffffff',
    ]);
  });

  it('returns correct h3Indexes of polygonFeature', () => {
    const result = getH3Indexes(polygonFeature, 2);
    expect(result).toStrictEqual([
      '821e27fffffffff',
      '821f0ffffffffff',
      '821e2ffffffffff',
      '821f57fffffffff',
    ]);
  });

  it('returns warning when Point geometry type specified', () => {
    const features = [{ geometry: { type: 'Point', coordinates: [0, 0] } }];
    console.warn = vi.fn();
    getH3Indexes(features, 2);
    expect(console.warn).toHaveBeenCalledWith(
      'Unsupported GeoJson geometry type: Point'
    );
  });
});

describe('getTooltip', () => {
  const params = ['tooltip', 14, 4, 'people', 'orange'];

  it('returns tooltip without country and city', () => {
    const tooltipHtml = getTooltip(...params);
    const tooltipValue = tooltipHtml.querySelector('[data-id=tooltipValue]');
    const tooltipRank = tooltipHtml.querySelector('[data-id=tooltipRank]');
    const tooltipCountry = tooltipHtml.querySelector(
      '[data-id=tooltipCountry]'
    );
    const tooltipCity = tooltipHtml.querySelector('[data-id=tooltipCity]');

    expect(tooltipValue.textContent).toBe('14 people');
    expect(tooltipRank.textContent).toBe('4');
    expect(tooltipHtml.style.getPropertyValue('--tooltip-accent')).toBe(
      'orange'
    );
    expect(tooltipCountry).toBe(null);
    expect(tooltipCity).toBe(null);
  });

  it('returns tooltip with country and without city', () => {
    const tooltipHtml = getTooltip(...params, 'United States');
    const tooltipCountry = tooltipHtml.querySelector(
      '[data-id=tooltipCountry]'
    );
    const tooltipCity = tooltipHtml.querySelector('[data-id=tooltipCity]');

    expect(tooltipCountry.textContent).toBe('United States');
    expect(tooltipCity).toBe(null);
  });

  it('returns tooltip with city and without country', () => {
    const tooltipHtml = getTooltip(...params, undefined, 'New York');
    const tooltipCountry = tooltipHtml.querySelector(
      '[data-id=tooltipCountry]'
    );
    const tooltipCity = tooltipHtml.querySelector('[data-id=tooltipCity]');

    expect(tooltipCountry).toBe(null);
    expect(tooltipCity.textContent).toBe('New York');
  });

  it('returns tooltip with country and city specified', () => {
    const tooltipHtml = getTooltip(...params, 'USA', 'New York');
    const tooltipCountry = tooltipHtml.querySelector(
      '[data-id=tooltipCountry]'
    );
    const tooltipCity = tooltipHtml.querySelector('[data-id=tooltipCity]');

    expect(tooltipCountry.textContent).toBe('USA');
    expect(tooltipCity.textContent).toBe('New York');
  });
});
