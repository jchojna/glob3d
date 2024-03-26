import { getCitiesData } from './js/citiesData';
import WebGLobe from './lib/globe';
import './style.css';

const root = document.querySelector('#root');
const updateButton = document.querySelector('.update-button');
if (!root || !(root instanceof HTMLElement)) {
  throw new Error('Root element not found');
}
const data = await getCitiesData();
// console.log('Prepared countries data', data);
const globeInstance = new WebGLobe(root, 100, 3, 0.2, 5, true);
globeInstance.initialize(data);

updateButton &&
  updateButton.addEventListener('click', async () => {
    globeInstance.clean();
    globeInstance.update(data);
  });
