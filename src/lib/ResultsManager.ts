import classes from '../styles/results.module.css';
import Result from './Result';

export default class ResultsManager {
  protected _results: HTMLDivElement[];
  protected _hoveredHexId: string | null;
  protected _clickedHexId: string | null;

  constructor(
    root: HTMLElement,
    data: HexData[],
    protected _options: ResultsOptions
  ) {
    this._results = [];
    this._hoveredHexId = null;
    this._clickedHexId = null;

    this.createResults(data, {
      tooltipActiveBackgroundColor: _options.tooltipActiveBackgroundColor,
      tooltipActiveTextColor: _options.tooltipActiveTextColor,
      valueSuffix: _options.valueSuffix,
    });
    this.#appendResults(root);
  }

  get results(): HTMLDivElement[] {
    return this._results;
  }

  set clickedHexId(id: string | null) {
    this._clickedHexId = id;
  }

  set hoveredHexId(id: string | null) {
    this._hoveredHexId = id;
  }

  set activeResultColors({ backgroundColor, textColor }: ResultColors) {
    this._options = {
      ...this._options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
  }

  protected createResults(data: HexData[], options: ResultsOptions) {
    this._results = data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => {
        return new Result(hexData, options).result;
      });
  }

  #appendResults(root: HTMLElement) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = classes.container;
    this._results.forEach((result) => {
      if (result) resultsContainer.appendChild(result);
    });
    root.appendChild(resultsContainer);
  }
}
