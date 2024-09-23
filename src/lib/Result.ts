import { getResultNode } from '../utils/helpers';

export default class Result {
  #element: HTMLDivElement;
  id: string;
  activeBackgroundColor: string | undefined;
  activeTextColor: string | undefined;

  constructor(
    { id, country, city, value, valueRank }: HexData,
    { activeBackgroundColor, activeTextColor, valueSuffix }: ResultsOptions
  ) {
    this.#element = getResultNode(
      id,
      'score',
      value,
      valueRank,
      valueSuffix,
      activeBackgroundColor,
      country,
      city
    );
    this.id = id;
    this.activeBackgroundColor = activeBackgroundColor;
    this.activeTextColor = activeTextColor;
  }

  get element() {
    return this.#element;
  }

  show() {
    this.element.style.backgroundColor = '#fff';
    this.element.style.color = '#000';
    this.element.style.opacity = '1';
  }

  makeActive() {
    if (this.activeBackgroundColor) {
      this.element.style.backgroundColor = this.activeBackgroundColor;
    }
    if (this.activeTextColor) {
      this.element.style.color = this.activeTextColor;
    }
  }
}
