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
});
globeInstance.initialize(data);

updateButton &&
  updateButton.addEventListener('click', async () => {
    globeInstance.clean();
    globeInstance.update(data);
  });
