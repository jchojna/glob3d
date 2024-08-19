export default class Result {
  #resultNode: HTMLElement | null;

  constructor(data: HexData) {
    this.#resultNode = null;

    this.#createResultNode(data);
  }

  #createResultNode(data: HexData) {
    const node = document.createElement('div');
    node.classList.add('result');
    node.innerHTML = `
      <h2>${data.city}</h2>
      <p>Country: ${data.country}</p>
      <p>Value: ${data.value}</p>
      <p>Rank: ${data.valueRank}</p>
    `;
    this.#resultNode = node;
  }

  get result() {
    return this.#resultNode;
  }
}
