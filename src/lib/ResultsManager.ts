import Result from './Result';

export default class ResultsManager {
  #results: (HTMLElement | null)[];

  constructor(root: HTMLElement, data: HexData[]) {
    this.#results = [];

    this.#createResults(data);
    this.#appendResults(root);
  }

  #createResults(data: HexData[]) {
    this.#results = data.map((hexData: HexData) => {
      return new Result(hexData).result;
    });
  }

  #appendResults(root: HTMLElement) {
    const resultsContainer = document.createElement('div');
    resultsContainer.style.cssText = `
      position: absolute;
    `;
    this.#results.forEach((result) => {
      if (result) resultsContainer.appendChild(result);
    });
    root.appendChild(resultsContainer);
  }
}
