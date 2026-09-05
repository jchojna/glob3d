import { bindTooltipContent, createTooltipElement } from '../utils/helpers';

export type TooltipViewState = {
  posX: number;
  posY: number;
  scale: number;
  zIndex: number;
  visible: boolean;
  active: boolean;
  accentColor: string;
  activeBackgroundColor: string;
  activeTextColor: string;
};

export type TooltipContent = {
  id: string;
  value: number;
  valueRank: number;
  city?: string;
  country?: string;
  tooltipValueSuffix: string;
  accentColor: string;
};

export default class Tooltip {
  element: HTMLElement;
  id: string | null;
  #posX = Number.NaN;
  #posY = Number.NaN;
  #scale = Number.NaN;
  #zIndex = Number.NaN;
  #visible = false;
  #active = false;
  #accentColor = '';
  #activeBackgroundColor = '';
  #activeTextColor = '';

  constructor() {
    this.element = createTooltipElement();
    this.id = null;
  }

  bind(content: TooltipContent) {
    this.id = content.id;
    bindTooltipContent(this.element, content);
  }

  apply({
    posX,
    posY,
    scale,
    zIndex,
    visible,
    active,
    accentColor,
    activeBackgroundColor,
    activeTextColor,
  }: TooltipViewState) {
    if (this.#posX !== posX || this.#posY !== posY || this.#scale !== scale) {
      this.#posX = posX;
      this.#posY = posY;
      this.#scale = scale;
      this.element.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    }

    if (this.#zIndex !== zIndex) {
      this.#zIndex = zIndex;
      this.element.style.zIndex = String(zIndex);
    }

    if (this.#visible !== visible) {
      this.#visible = visible;
      this.element.classList.toggle('glob3d-tooltip-visible', visible);
    }

    if (this.#active !== active) {
      this.#active = active;
      this.element.classList.toggle('glob3d-tooltip-active', active);
    }

    if (this.#accentColor !== accentColor) {
      this.#accentColor = accentColor;
      this.element.style.setProperty('--tooltip-accent', accentColor);
    }

    if (this.#activeBackgroundColor !== activeBackgroundColor) {
      this.#activeBackgroundColor = activeBackgroundColor;
      this.element.style.setProperty(
        '--tooltip-active-bg',
        activeBackgroundColor
      );
    }

    if (this.#activeTextColor !== activeTextColor) {
      this.#activeTextColor = activeTextColor;
      this.element.style.setProperty('--tooltip-active-fg', activeTextColor);
    }
  }

  hide() {
    this.apply({
      posX: Number.isNaN(this.#posX) ? 0 : this.#posX,
      posY: Number.isNaN(this.#posY) ? 0 : this.#posY,
      scale: Number.isNaN(this.#scale) ? 0 : this.#scale,
      zIndex: Number.isNaN(this.#zIndex) ? 0 : this.#zIndex,
      visible: false,
      active: false,
      accentColor: this.#accentColor,
      activeBackgroundColor: this.#activeBackgroundColor,
      activeTextColor: this.#activeTextColor,
    });
  }
}
