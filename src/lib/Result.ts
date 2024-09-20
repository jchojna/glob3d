import { getResultNode } from '../utils/helpers';

export default class Result {
  #result: HTMLDivElement;

  constructor(
    { id, country, city, value, valueRank }: HexData,
    {
      activeBackgroundColor: tooltipActiveBackgroundColor,
      valueSuffix,
    }: ResultsOptions
  ) {
    this.#result = getResultNode(
      id,
      'score',
      value,
      valueRank,
      valueSuffix,
      tooltipActiveBackgroundColor,
      country,
      city
    );
  }

  get result() {
    return this.#result;
  }
}
