import * as THREE from 'three';

import { getTooltipScale, getXYZCoordinates } from '../utils/helpers';
import { ensureTooltipStyles, tooltipsStyles } from '../utils/styles';
import {
  getValueRanks,
  isPointOccludedBySphere,
  selectVisibleTooltipIndices,
} from '../utils/tooltipMath';
import Tooltip from './TooltipElement';

type TooltipsOptions = {
  tooltipActiveBackgroundColor: string;
  tooltipActiveTextColor: string;
  tooltipValueSuffix: string;
  tooltipsLimit: number | null;
};

type TooltipColors = {
  backgroundColor: string;
  textColor: string;
};

type TooltipModel = {
  id: string;
  coordinates: THREE.Vector3;
  distance: number;
  value: number;
  valueRank: number;
  city?: string;
  country?: string;
};

const _projected = new THREE.Vector3();

export default class TooltipsManager {
  #root: HTMLElement;
  #globeRadius: number;
  #camera: THREE.PerspectiveCamera;
  #options: TooltipsOptions;
  #sizes: { width: number; height: number };
  #models: TooltipModel[];
  #distances: Float64Array;
  #indexById: Map<string, number>;
  #views: Map<string, Tooltip>;
  #pool: Tooltip[];
  #tooltipsContainer: HTMLElement | null;
  #clickedBarId: string | null;
  #hoveredBarId: string | null;
  #dirty: boolean;
  #overlayWidth: number;
  #overlayHeight: number;

  constructor(
    root: HTMLElement,
    globeRadius: number,
    camera: THREE.PerspectiveCamera,
    sizes: { width: number; height: number },
    options: TooltipsOptions
  ) {
    this.#root = root;
    this.#globeRadius = globeRadius;
    this.#camera = camera;
    this.#sizes = sizes;
    this.#options = options;
    this.#models = [];
    this.#distances = new Float64Array(0);
    this.#indexById = new Map();
    this.#views = new Map();
    this.#pool = [];
    this.#tooltipsContainer = null;
    this.#clickedBarId = null;
    this.#hoveredBarId = null;
    this.#dirty = true;
    this.#overlayWidth = 0;
    this.#overlayHeight = 0;
    ensureTooltipStyles();
  }

  get models(): TooltipModel[] {
    return this.#models;
  }

  get tooltipCount(): number {
    return this.#views.size;
  }

  set clickedBarId(id: string | null) {
    if (this.#clickedBarId === id) return;
    this.#clickedBarId = id;
    this.#dirty = true;
  }

  set hoveredBarId(id: string | null) {
    if (this.#hoveredBarId === id) return;
    this.#hoveredBarId = id;
    this.#dirty = true;
  }

  set activeTooltipColors({ backgroundColor, textColor }: TooltipColors) {
    this.#options = {
      ...this.#options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
    this.#dirty = true;
  }

  createTooltips(data: BarData[]): HTMLElement | undefined {
    this.removeTooltips();
    if (!data.length) return;

    const ranks = getValueRanks(data.map((bar) => bar.value));
    this.#models = data.map((bar, index) => {
      const { x, y, z } = getXYZCoordinates(
        bar.center[0],
        bar.center[1],
        bar.offsetFromCenter
      );
      return {
        id: bar.id,
        coordinates: new THREE.Vector3(x, y, z),
        distance: 0,
        value: bar.value,
        valueRank: ranks[index],
        city: bar.city,
        country: bar.country,
      };
    });
    this.#distances = new Float64Array(data.length);
    this.#models.forEach((model, index) => {
      this.#indexById.set(model.id, index);
    });

    const tooltipsContainer = document.createElement('div');
    tooltipsContainer.style.cssText = tooltipsStyles;
    this.#root.appendChild(tooltipsContainer);
    this.#tooltipsContainer = tooltipsContainer;
    this.#dirty = true;
    return tooltipsContainer;
  }

  removeTooltips() {
    this.#views.forEach((view) => view.element.remove());
    this.#views.clear();
    this.#pool = [];
    this.#tooltipsContainer?.remove();
    this.#tooltipsContainer = null;
    this.#models = [];
    this.#distances = new Float64Array(0);
    this.#indexById.clear();
    this.#clickedBarId = null;
    this.#hoveredBarId = null;
    this.#dirty = false;
    this.#overlayWidth = 0;
    this.#overlayHeight = 0;
  }

  #getIndex(id: string | null): number | null {
    if (id === null) return null;
    const index = this.#indexById.get(id);
    return index === undefined ? null : index;
  }

  #updateDistances() {
    const cameraPosition = this.#camera.position;
    for (let i = 0; i < this.#models.length; i += 1) {
      const distance = this.#models[i].coordinates.distanceTo(cameraPosition);
      this.#distances[i] = distance;
      this.#models[i].distance = distance;
    }
  }

  #acquireView(model: TooltipModel): Tooltip {
    const view = this.#pool.pop() ?? new Tooltip();
    view.bind({
      id: model.id,
      value: model.value,
      valueRank: model.valueRank,
      city: model.city,
      country: model.country,
      tooltipValueSuffix: this.#options.tooltipValueSuffix,
      accentColor: this.#options.tooltipActiveBackgroundColor,
    });
    this.#tooltipsContainer?.appendChild(view.element);
    this.#views.set(model.id, view);
    return view;
  }

  #releaseView(id: string, view: Tooltip) {
    view.hide();
    view.element.remove();
    view.id = null;
    this.#views.delete(id);
    this.#pool.push(view);
  }

  #syncVisibleViews() {
    if (!this.#tooltipsContainer || !this.#models.length) return;

    const limit =
      typeof this.#options.tooltipsLimit === 'number'
        ? this.#options.tooltipsLimit
        : this.#models.length;
    const selection = selectVisibleTooltipIndices(this.#distances, limit, [
      this.#getIndex(this.#hoveredBarId),
      this.#getIndex(this.#clickedBarId),
    ]);
    const selectedIds = new Set(
      selection.items.map((item) => this.#models[item.index].id)
    );

    this.#views.forEach((view, id) => {
      if (!selectedIds.has(id)) this.#releaseView(id, view);
    });

    const cameraPosition = this.#camera.position;
    const { minDistance, maxDistance } = selection;

    selection.items.forEach((item) => {
      const model = this.#models[item.index];
      const view = this.#views.get(model.id) ?? this.#acquireView(model);
      const isHovered = model.id === this.#hoveredBarId;
      const isClicked = model.id === this.#clickedBarId;
      const isActive = isHovered || isClicked;
      const occluded = isPointOccludedBySphere(
        model.coordinates,
        cameraPosition,
        this.#globeRadius
      );
      const visible = isActive || (item.inLimit && !occluded);

      _projected.copy(model.coordinates).project(this.#camera);
      const posX = ((_projected.x + 1) / 2) * this.#sizes.width;
      const posY = ((_projected.y - 1) / 2) * this.#sizes.height * -1;
      const scale =
        visible && minDistance <= maxDistance
          ? getTooltipScale(model.distance, minDistance, maxDistance)
          : 0;
      const zIndex = isClicked
        ? limit + 2
        : isHovered
        ? limit + 1
        : Math.max(limit - item.order, 0);

      view.apply({
        posX,
        posY,
        scale,
        zIndex,
        visible,
        active: isActive,
        accentColor: this.#options.tooltipActiveBackgroundColor,
        activeBackgroundColor: this.#options.tooltipActiveBackgroundColor,
        activeTextColor: this.#options.tooltipActiveTextColor,
      });
    });
  }

  #syncOverlaySize() {
    if (!this.#tooltipsContainer) return;
    if (
      this.#overlayWidth === this.#sizes.width &&
      this.#overlayHeight === this.#sizes.height
    ) {
      return;
    }
    this.#overlayWidth = this.#sizes.width;
    this.#overlayHeight = this.#sizes.height;
    this.#tooltipsContainer.style.width = `${this.#sizes.width}px`;
    this.#tooltipsContainer.style.height = `${this.#sizes.height}px`;
  }

  update({
    cameraChanged,
    layoutChanged,
  }: {
    cameraChanged: boolean;
    layoutChanged: boolean;
  }) {
    if (layoutChanged) this.#syncOverlaySize();
    if (cameraChanged || layoutChanged) this.#dirty = true;
    if (this.#dirty) {
      this.#updateDistances();
      this.#syncVisibleViews();
      this.#dirty = false;
    }
  }

  destroy() {
    this.removeTooltips();
  }
}
