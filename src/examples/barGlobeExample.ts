import BarGlob3d from '../lib/barGlobe';

document.addEventListener('DOMContentLoaded', () => {
  const appElement = document.getElementById('root');
  if (appElement) {
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
    ];

    const options = {
      barColor: '#ff0000',
    };

    new BarGlob3d(appElement, data, options);
  }
});
