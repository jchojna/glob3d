import { getResultNode } from '../utils/helpers';
import ResultsManager from './ResultsManager';

export default class Result {
  #element: HTMLDivElement;
  id: string;
  activeBackgroundColor: string | undefined;
  activeTextColor: string | undefined;

  constructor(
    { id, country, city, value, valueRank }: HexData,
    { activeBackgroundColor, activeTextColor, valueSuffix }: ResultsOptions,
    resultsManager: ResultsManager
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
    this.#bindEvents(resultsManager, id);
  }

  get resultElement() {
    return this.#element;
  }

  #bindEvents(resultsManager: ResultsManager, id: string) {
    this.#element.addEventListener('click', () => {
      resultsManager.clickedHexId = id;
    });
  }

  show() {
    this.#element.style.backgroundColor = '#fff';
    this.#element.style.color = '#000';
  }

  makeActive() {
    if (this.activeBackgroundColor) {
      this.#element.style.backgroundColor = this.activeBackgroundColor;
    }
    if (this.activeTextColor) {
      this.#element.style.color = this.activeTextColor;
    }
  }
}
