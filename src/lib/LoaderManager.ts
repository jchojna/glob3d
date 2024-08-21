import classes from '../styles/loader.module.css';

export default class LoaderManager {
  #loader: HTMLElement;

  constructor(root: HTMLElement) {
    this.#loader = this.createLoader(root);
  }

  createLoader(root: HTMLElement) {
    const loader = document.createElement('div');
    loader.className = classes.loader;
    root.appendChild(loader);
    return loader;
  }

  get loader(): HTMLElement {
    return this.#loader;
  }

  #updateLoaderText(loader: HTMLElement, text: string) {
    loader.innerHTML = text;
  }

  showLoader() {
    this.#updateLoaderText(this.#loader, 'Loading...');
    this.#loader.style.visibility = 'visible';
  }

  hideLoader() {
    this.#loader.style.visibility = 'hidden';
  }

  showError() {
    this.#updateLoaderText(this.#loader, 'Error');
    this.#loader.style.visibility = 'visible';
  }

  updateLoaderPosition(globePosition: GlobePosition) {
    if (!this.#loader || this.#loader.style.visibility == 'hidden') return;
    this.#loader.style.top = `${globePosition.y}px`;
    this.#loader.style.left = `${globePosition.x}px`;
  }
}
