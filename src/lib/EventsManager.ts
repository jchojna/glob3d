import Result from './Result';
import Tooltip from './Tooltip';

type HexBars = HexResult[] | undefined;
type Results = Result[] | undefined;
type Tooltips = Tooltip[] | undefined;

type Theme = {
  barColor: string;
  barOpacity: number;
  barActiveColor: string;
  barActiveOpacity: number;
};

export default class EventsManager {
  #hexBars: HexBars;
  #results: Results;
  #tooltips: Tooltips;
  #hoveredItemId: string | null;
  #clickedItemId: string | null;
  #barColor: string;
  #barOpacity: number;
  #barActiveColor: string;
  #barActiveOpacity: number;

  constructor(
    { barColor, barOpacity, barActiveColor, barActiveOpacity }: Theme,
    hexBars?: HexBars,
    results?: Results,
    tooltips?: Tooltips
  ) {
    this.#hexBars = hexBars;
    this.#results = results;
    this.#tooltips = tooltips;
    this.#hoveredItemId = null;
    this.#clickedItemId = null;
    this.#barColor = barColor;
    this.#barOpacity = barOpacity;
    this.#barActiveColor = barActiveColor;
    this.#barActiveOpacity = barActiveOpacity;
  }

  set hexBars(hexBars: HexBars) {
    this.#hexBars = hexBars;
    console.log('set hexBars:', this.#hexBars);
  }

  set results(results: Results) {
    this.#results = results;
    console.log('set results', this.#results);
  }

  set tooltips(tooltips: Tooltips) {
    this.#tooltips = tooltips;
    console.log('set tooltips', this.#tooltips);
  }

  set clickedItemId(id: string | null) {
    this.#clickedItemId = id;
    console.log('set clicked item id', this.#clickedItemId);
  }

  set hoveredItemId(id: string | null) {
    const lastHoveredItem = this.#hoveredItemId;
    this.#hoveredItemId = id;

    console.log('set hovered item id', this.#hoveredItemId);

    if (this.#hoveredItemId) {
      this.#highlightHex(
        this.#hexBars?.find((hexBar) => hexBar.uuid === this.#hoveredItemId)
      );
    } else {
      this.#unhighlightHex(
        this.#hexBars?.find((hexBar) => hexBar.uuid === lastHoveredItem)
      );
    }
  }

  get clickedItemId() {
    return this.#clickedItemId;
  }

  get hoveredItemId() {
    return this.#hoveredItemId;
  }

  #highlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barActiveColor);
    object.material.opacity = this.#barActiveOpacity;
  }

  #unhighlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barColor);
    object.material.opacity = this.#barOpacity;
  }
}
