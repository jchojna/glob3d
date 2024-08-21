import { getResultNode } from '../utils/helpers';

export default class Result {
  #result: HTMLDivElement;

  constructor(
    { id, country, city, value, valueRank }: HexData,
    { tooltipActiveBackgroundColor, valueSuffix }: ResultOptions
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
