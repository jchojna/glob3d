import { getCitiesData } from './js/citiesData';
import BarGlob3d from './lib/barGlobe';
import './styles.css';

const root = document.querySelector('#root');
const updateButton = document.querySelector('.update-button');
if (!root || !(root instanceof HTMLElement)) {
  throw new Error('Root element not found');
}
const data = getCitiesData();
const globeInstance = new BarGlob3d(root, {
  debugMode: true,
  globeRadius: 100,
  hexMargin: 0.2,
  hexRes: 3,
  highestBar: 0.5,
});
globeInstance.initialize(data);

updateButton &&
  updateButton.addEventListener('click', async () => {
    globeInstance.clean();
    globeInstance.update(data);
  });
