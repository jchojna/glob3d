import { loaderStyles } from '../utils/styles';

export default class Loader {
  #loader: HTMLElement;

  constructor(root: HTMLElement) {
    this.#loader = this.createLoader(root);
  }

  createLoader(root: HTMLElement) {
    const loader = document.createElement('div');
    loader.style.cssText = loaderStyles;
    root.appendChild(loader);
    return loader;
  }

  get loader(): HTMLElement {
    return this.#loader;
  }
}
