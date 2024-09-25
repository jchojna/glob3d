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
  activeBackgroundColor: string;
  activeTextColor: string;
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
  activeBackgroundColor: string;
  activeTextColor: string;

  constructor(
    {
      barColor,
      barOpacity,
      barActiveColor,
      barActiveOpacity,
      activeBackgroundColor,
      activeTextColor,
    }: Theme,
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
    this.activeBackgroundColor = activeBackgroundColor;
    this.activeTextColor = activeTextColor;
    this.#bindWindowClickEvent();
  }

  #bindWindowClickEvent() {
    window.addEventListener('click', () => {
      if (this.#hoveredItemId) {
        this.clickedItemId = this.#hoveredItemId;
      } else {
        this.clickedItemId = null;
      }
    });
  }

  set hexBars(hexBars: HexBars) {
    this.#hexBars = hexBars;
    console.log('set hexBars:', this.#hexBars);
  }

  set results(results: Results) {
    this.#results = results;
    console.log('set results', this.#results);

    this.#results && this.#bindResultNodesEvents(this.#results);
  }

  set tooltips(tooltips: Tooltips) {
    this.#tooltips = tooltips;
    console.log('set tooltips', this.#tooltips);

    this.#tooltips && this.#bindTooltipNodesEvents(this.#tooltips);
  }

  set clickedItemId(id: string | null) {
    const lastClickedItemId = this.#clickedItemId;
    this.#clickedItemId = id;

    console.log('set clicked item id', this.#clickedItemId);

    if (this.#clickedItemId) {
      this.#highlightHex(
        this.#hexBars?.find((hexBar) => hexBar.uuid === this.#clickedItemId)
      );
    }

    this.#unhighlightHex(
      this.#hexBars?.find((hexBar) => hexBar.uuid === lastClickedItemId)
    );
  }

  set hoveredItemId(id: string | null) {
    const lastHoveredItemId = this.#hoveredItemId;
    this.#hoveredItemId = id;

    console.log('set hovered item id', this.#hoveredItemId);

    if (this.#hoveredItemId) {
      this.#highlightHex(
        this.#hexBars?.find((hexBar) => hexBar.uuid === this.#hoveredItemId)
      );
    } else {
      this.#unhighlightHex(
        this.#hexBars?.find(
          (hexBar) =>
            hexBar.uuid === lastHoveredItemId &&
            lastHoveredItemId !== this.#clickedItemId
        )
      );
    }
  }

  get clickedItemId() {
    return this.#clickedItemId;
  }

  get hoveredItemId() {
    return this.#hoveredItemId;
  }

  set barActiveColor(color: string) {
    this.#barActiveColor = color;
  }

  #bindResultNodesEvents(nodes: Result[]) {
    nodes.forEach((node) => {
      node.resultElement.addEventListener('mouseenter', () => {
        this.hoveredItemId = node.id;
      });

      node.resultElement.addEventListener('mouseleave', () => {
        this.hoveredItemId = null;
      });
    });
  }

  #bindTooltipNodesEvents(nodes: Tooltip[]) {
    nodes.forEach((node) => {
      node.element.addEventListener('mouseenter', () => {
        this.hoveredItemId = node.id;
      });

      node.element.addEventListener('mouseleave', () => {
        this.hoveredItemId = null;
      });
    });
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
