import * as THREE from 'three';
// import defaultOpts from '../utils/defaultOpts';
import { getXYZCoordinates } from '../utils/helpers';
import { tooltipsStyles } from '../utils/styles';
import Tooltip from './Tooltip';

type TooltipsOptions = {
  tooltipActiveBackgroundColor: string;
  tooltipActiveTextColor: string;
  tooltipValueSuffix: string;
  tooltipsLimit: number;
};

// const options = {
//   tooltipActiveBackgroundColor: defaultOpts.tooltipActiveBackgroundColor,
//   tooltipActiveTextColor: defaultOpts.tooltipActiveTextColor,
//   tooltipValueSuffix: defaultOpts.tooltipValueSuffix,
//   tooltipsLimit: defaultOpts.tooltipsLimit,
// };

export default class TooltipsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #options: TooltipsOptions;
  #tooltips: TooltipProperties[];

  // #tooltipActiveTextColor: string;
  // #tooltipValueSuffix: string;

  constructor(root: HTMLElement, globe: THREE.Mesh, options: TooltipsOptions) {
    this.#root = root;
    this.#globe = globe;
    this.#options = options;
    this.#tooltips = [];
  }

  get tooltips(): TooltipProperties[] {
    return this.#tooltips;
  }

  // TODO: refactor the method
  createTooltips(data: HexData[]): HTMLElement | undefined {
    if (!data.length) return;
    this.#tooltips = data.map(
      ({ id, center, country, city, value, offsetFromCenter }: HexData) => {
        const valueRank = this.getValueRank(
          value,
          data.map((hex) => hex.value)
        );
        const coordinates = getXYZCoordinates(
          center[0],
          center[1],
          offsetFromCenter
        );
        return new Tooltip(
          id,
          coordinates,
          { width: this.#root.clientWidth, height: this.#root.clientHeight },
          this.#options.tooltipsLimit || data.length,
          value,
          {
            city,
            country,
            mask: this.#globe,
            tooltipActiveBackgroundColor:
              this.#options.tooltipActiveBackgroundColor,
            tooltipActiveTextColor: this.#options.tooltipActiveTextColor,
            tooltipValueSuffix: this.#options.tooltipValueSuffix,
            valueRank,
          }
        );
      }
    );
    const tooltipsElements = this.#tooltips.map((tooltip) => tooltip.element);
    const tooltips = document.createElement('div');
    tooltips.style.cssText = tooltipsStyles;
    tooltips.append(...tooltipsElements);
    this.#root.style.position = 'relative';
    this.#root.appendChild(tooltips);
  }

  getValueRank(value: number, values: number[]): number {
    return values.filter((val: number) => val > value).length + 1;
  }
}
