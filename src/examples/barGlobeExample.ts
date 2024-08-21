import BarGlob3d from '../lib/BarGlob3d';

const data = [
  {
    country: 'Poland',
    city: 'Warsaw',
    coordinates: {
      lon: 21.0122,
      lat: 52.2297,
    },
    value: 1_790_658,
  },
  {
    country: 'Germany',
    city: 'Berlin',
    coordinates: {
      lon: 13.405,
      lat: 52.52,
    },
    value: 3_769_495,
  },
  {
    country: 'France',
    city: 'Paris',
    coordinates: {
      lon: 2.3522,
      lat: 48.8566,
    },
    value: 2_206_488,
  },
  {
    country: 'Spain',
    city: 'Madrid',
    coordinates: {
      lon: -3.7038,
      lat: 40.4168,
    },
    value: 3_223_334,
  },
  {
    country: 'Italy',
    city: 'Rome',
    coordinates: {
      lon: 12.4964,
      lat: 41.9028,
    },
    value: 2_870_549,
  },
  {
    country: 'United Kingdom',
    city: 'London',
    coordinates: {
      lon: -0.1276,
      lat: 51.5072,
    },
    value: 3_287_412,
  },
  {
    country: 'United States',
    city: 'New York',
    coordinates: {
      lon: -74.006,
      lat: 40.7128,
    },
    value: 8_336_817,
  },
  {
    country: 'China',
    city: 'Beijing',
    coordinates: {
      lon: 116.4074,
      lat: 39.9042,
    },
    value: 21_516_000,
  },
];

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  const updateButton = document.createElement('button');
  const colorButton = document.createElement('button');
  updateButton.style.position = 'absolute';
  colorButton.style.position = 'absolute';
  colorButton.style.top = '30px';
  updateButton.innerText = 'Update';
  colorButton.innerText = 'Change color';

  if (root) {
    root.appendChild(updateButton);
    root.appendChild(colorButton);

    const globe = new BarGlob3d(root, [], { valueSuffix: ' people' });
    globe.onLoading();
    // globe.onError();

    setTimeout(() => {
      globe.onUpdate(data);
    }, 1000);

    updateButton.addEventListener('click', () => {
      globe.onUpdate(data);
    });
    colorButton.addEventListener('click', () => {
      globe.setActiveColor('blue');
    });
  }
});
