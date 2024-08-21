import classes from '../styles/results.module.css';
import Result from './Result';

export default class ResultsManager {
  #results: HTMLDivElement[];

  constructor(
    root: HTMLElement,
    data: HexData[],
    { tooltipActiveBackgroundColor, valueSuffix }: ResultOptions
  ) {
    this.#results = [];

    this.#createResults(data, {
      tooltipActiveBackgroundColor,
      valueSuffix,
    });
    this.#appendResults(root);
  }

  #createResults(data: HexData[], options: ResultOptions) {
    this.#results = data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => {
        return new Result(hexData, options).result;
      });
  }

  #appendResults(root: HTMLElement) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = classes.container;
    this.#results.forEach((result) => {
      if (result) resultsContainer.appendChild(result);
    });
    root.appendChild(resultsContainer);
  }

  get results() {
    return this.#results;
  }
}
